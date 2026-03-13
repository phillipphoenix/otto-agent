import type { PrimitiveEntry } from "./types";
import type { EventEmitter } from "../events";
import { EventType } from "../events";
import { runCommand } from "./runner";

export interface CheckResults {
  passed: string[];
  failed: Array<{ name: string; output: string }>;
}

export async function runChecks(
  entries: PrimitiveEntry[],
  emitter?: EventEmitter,
): Promise<CheckResults> {
  const passed: string[] = [];
  const failed: Array<{ name: string; output: string }> = [];

  for (const entry of entries) {
    if (!entry.frontmatter.command) continue;

    const result = await runCommand(entry.frontmatter.command, {
      timeout: entry.frontmatter.timeout ?? undefined,
    });

    if (result.exitCode === 0) {
      passed.push(entry.name);
      emitter?.emit({
        type: EventType.CHECK_PASSED,
        timestamp: Date.now(),
        data: { name: entry.name },
      });
    } else {
      const output = `${result.stdout}\n${result.stderr}`.trim();
      failed.push({ name: entry.name, output });
      emitter?.emit({
        type: EventType.CHECK_FAILED,
        timestamp: Date.now(),
        data: {
          name: entry.name,
          output,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        },
      });
    }
  }

  return { passed, failed };
}
