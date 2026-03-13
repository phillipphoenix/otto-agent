export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function runCommand(
  command: string,
  options?: { timeout?: number; cwd?: string },
): Promise<RunCommandResult> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;

  if (options?.timeout && options.timeout > 0) {
    const timeoutMs = options.timeout * 1000;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    proc.exited.then(() => clearTimeout(timer));
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    stdout,
    stderr,
    exitCode: timedOut ? -1 : exitCode,
    timedOut,
  };
}
