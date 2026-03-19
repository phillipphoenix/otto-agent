import type { CompletionCheckEntry, PrimitiveEntry } from "./types";
import { resolveTemplate } from "../resolver";

const YES_NO_INSTRUCTION = `\n\nBased on the above, has the task been completed successfully?\nRespond with exactly YES or NO (case-insensitive). No other text.`;

/**
 * Runs the completion check for a workflow iteration.
 * Returns true if the check indicates the task is complete (YES), false otherwise.
 */
export async function runCompletionCheck(
  entry: CompletionCheckEntry,
  agentCommand: string,
  contexts: Map<string, string>,
  instructions: Map<string, string>,
  checkFailuresText?: string,
): Promise<boolean> {
  const resolvedPrompt = resolveTemplate(entry.body, contexts, instructions, checkFailuresText);
  const prompt = resolvedPrompt + YES_NO_INSTRUCTION;

  const proc = Bun.spawn([agentCommand, "--print"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  proc.stdin.write(prompt);
  proc.stdin.end();

  const decoder = new TextDecoder();
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();

  await proc.exited;

  return output.trim().toUpperCase() === "YES";
}
