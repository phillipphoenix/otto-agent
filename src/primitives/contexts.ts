import type { PrimitiveEntry } from "./types";
import { runCommand } from "./runner";

export async function runContexts(
  entries: PrimitiveEntry[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const entry of entries) {
    if (entry.frontmatter.command) {
      const result = await runCommand(entry.frontmatter.command, {
        timeout: entry.frontmatter.timeout ?? undefined,
      });
      // Use stdout on success, include stderr on failure
      const content =
        result.exitCode === 0
          ? result.stdout
          : `[command failed (exit ${result.exitCode})]\n${result.stdout}\n${result.stderr}`.trim();
      results.set(entry.name, content);
    } else {
      results.set(entry.name, entry.body);
    }
  }

  return results;
}
