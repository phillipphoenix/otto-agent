import { currentVersion } from "./version";

const GITHUB_REPO = "phillipphoenix/otto-agent";
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Compares two semver strings. Returns true if b is newer than a. */
function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj = 0, aMin = 0, aPatch = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPatch = 0] = parse(b);
  if (bMaj !== aMaj) return bMaj > aMaj;
  if (bMin !== aMin) return bMin > aMin;
  return bPatch > aPatch;
}

/** Maps process.platform + process.arch to the binary artifact name. */
function platformTarget(): string | null {
  const { platform, arch } = process;
  const archMap: Record<string, string> = { x64: "x64", arm64: "arm64" };
  const a = archMap[arch];
  if (!a) return null;
  if (platform === "linux") return `otto-linux-${a}`;
  if (platform === "darwin") return `otto-darwin-${a}`;
  if (platform === "win32") return `otto-windows-${a}.exe`;
  return null;
}

/** Fetches the latest release tag from GitHub. Returns null on any error. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { tag_name?: string };
    return json.tag_name ?? null;
  } catch {
    return null;
  }
}

/**
 * Downloads the binary for the current platform from the given release and
 * atomically replaces `process.execPath`.
 *
 * On Windows, the running binary is locked, so instead of replacing it
 * directly we write a `.cmd` shim that will swap the file after this process
 * exits.
 */
export async function downloadAndApply(
  latestVersion: string,
  assets: Array<{ name: string; browser_download_url: string }>
): Promise<void> {
  const target = platformTarget();
  if (!target) throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);

  const asset = assets.find((a) => a.name === target);
  if (!asset) throw new Error(`No release asset found for ${target}`);

  const res = await fetch(asset.browser_download_url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const execPath = process.execPath;

  if (process.platform === "win32") {
    // Windows: write new binary to a temp path, then create a .cmd shim to
    // swap it after this process exits (locked-binary workaround).
    const tmpPath = execPath + ".new";
    await Bun.file(tmpPath).writer().write(bytes);

    const shimPath = execPath + ".update.cmd";
    const shim = [
      "@echo off",
      // Wait for the otto process to exit by polling the lock on the binary.
      `:wait`,
      `2>nul (`,
      `  del /f "${execPath}" && goto :swap`,
      `)`,
      `timeout /t 1 /nobreak >nul`,
      `goto :wait`,
      `:swap`,
      `move /y "${tmpPath}" "${execPath}"`,
      `del "%~f0"`,
    ].join("\r\n");

    await Bun.write(shimPath, shim);

    // Spawn the shim detached so it survives past this process.
    Bun.spawn(["cmd", "/c", shimPath], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } else {
    // Unix: write to a temp file then rename atomically.
    const tmpPath = execPath + ".new";
    await Bun.write(tmpPath, bytes);
    await Bun.file(tmpPath).exists(); // ensure flush
    await Bun.$`chmod +x ${tmpPath}`.quiet();
    await Bun.$`mv -f ${tmpPath} ${execPath}`.quiet();
  }
}

export type UpdateResult =
  | { status: "up-to-date"; version: string }
  | { status: "updated"; from: string; to: string; windowsDeferred: boolean }
  | { status: "error"; message: string };

/**
 * Fetches the latest version, downloads it if newer, and applies the update.
 * Always returns a human-readable result; never throws.
 */
export async function runUpdate(): Promise<UpdateResult> {
  try {
    const latestTag = await fetchLatestVersion();
    if (!latestTag) return { status: "error", message: "Could not fetch latest version." };

    const latest = latestTag.replace(/^v/, "");
    if (!isNewer(currentVersion, latest)) {
      return { status: "up-to-date", version: currentVersion };
    }

    // Fetch release assets list.
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${latestTag}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return { status: "error", message: `GitHub API error: ${res.status}` };
    const release = (await res.json()) as {
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    await downloadAndApply(latest, release.assets);

    return {
      status: "updated",
      from: currentVersion,
      to: latest,
      windowsDeferred: process.platform === "win32",
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
