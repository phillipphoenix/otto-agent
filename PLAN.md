# Plan: Auto-update, build pipeline & distribution for Otto CLI (#11)

## Summary

Implement a self-update mechanism that checks GitHub releases on every startup, silently downloads and applies updates, shows an Ink-rendered notice post-run, and provides an `otto update` subcommand. Also adds a GitHub Actions release workflow to compile and publish Bun binaries for 5 platforms.

## Architecture

### Core update module (`src/updater.ts`)
- `fetchLatestVersion()` — fetches tag from GitHub releases API, 3s timeout, silent on error
- `downloadAndApply(currentVersion, latestVersion)` — downloads platform-correct binary, atomically replaces `process.execPath`
- On Windows, writes a `.cmd` shim for deferred swap (locked binary workaround)
- `runUpdate()` — orchestrates fetch+apply, returns human-readable status string

### Startup integration (`src/commands/run.ts`)
- Before launching Ink, start `updateCheck()` in background (non-blocking)
- After `enginePromise` and `inkApp.waitUntilExit()` resolve, conditionally render a second Ink pass for the update notice

### Update notice component (`src/ui/UpdateNotice.tsx`)
- Renders a bordered box with `previous → next` version info
- Auto-dismisses after 10 seconds via `setTimeout(() => exit(), 10_000)`
- Styled consistently with Otto's visual language

### `otto update` subcommand (`src/commands/update.ts`)
- Renders an Ink component that calls `runUpdate()`, then exits
- No app shell launched
- Shows explicit error output on failure (unlike silent startup path)

### CLI registration (`src/cli.ts`)
- Add `update` case to the switch, calling `updateCommand()`
- Update help text

### GitHub Actions release workflow (`.github/workflows/release.yml`)
- Triggered on `push` to tags matching `v*`
- `sync-version` job: extracts version from tag, updates `package.json`
- `build` matrix job: compiles 5 platform targets with `CURRENT_VERSION` injected via `--define`
- Uploads artifacts to GitHub Release via `softprops/action-gh-release`

### Version declaration (`src/version.d.ts` or top of entry file)
- `declare const CURRENT_VERSION: string` for TypeScript to recognize the build-time constant

## Files to modify / create

- `src/updater.ts` — new: core update logic (fetch, download, apply, Windows shim)
- `src/ui/UpdateNotice.tsx` — new: Ink component for post-run notice
- `src/commands/update.ts` — new: `otto update` subcommand (Ink-based)
- `src/commands/run.ts` — modified: background update check, post-run notice rendering
- `src/cli.ts` — modified: add `update` case and help text
- `src/version.ts` — new: CURRENT_VERSION constant declaration
- `.github/workflows/release.yml` — new: multi-platform binary build & release workflow

## Notes

- GitHub repo is `phillipphoenix/otto-agent` (inferred from PR URLs in git log)
- All failure paths on startup must be fully silent — never crash or warn
- Windows: binary swap uses detached `.cmd` script polling until process exits
- Windows messaging must say "will apply on next run"
- Artifact naming: `otto-<platform>-<arch>` (with `.exe` for Windows)
- `CURRENT_VERSION` injected at build time; default to `"0.0.0"` in dev
- Version comparison: simple semver string comparison (major.minor.patch)
