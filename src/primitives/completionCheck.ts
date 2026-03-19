import type { CompletionCheckEntry, PrimitiveEntry } from "./types";
import { resolveTemplate } from "../resolver";

const COMPLETION_CHECK_JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: { completed: { type: "boolean" } },
  required: ["completed"],
});

const STRUCTURED_OUTPUT_INSTRUCTION = `

<output-format>
**IMPORTANT**: You MUST respond with a JSON object indicating whether the task is complete.
Output: {"completed": true} if the task is fully done, or {"completed": false} if work remains.
</output-format>`;

export type CompletionCheckResult = { completed: boolean; error?: string };

/**
 * Runs the completion check for a workflow iteration.
 * Returns { completed: true } if the check indicates the task is complete,
 * { completed: false } otherwise.
 * On parse failure, returns { completed: false, error: "..." }.
 */
export async function runCompletionCheck(
  entry: CompletionCheckEntry,
  agentCommand: string,
  contexts: Map<string, string>,
  instructions: Map<string, string>,
  checkFailuresText?: string,
): Promise<CompletionCheckResult> {
  const resolvedPrompt = resolveTemplate(entry.body, contexts, instructions, checkFailuresText);
  const prompt = resolvedPrompt + STRUCTURED_OUTPUT_INSTRUCTION;

  const proc = Bun.spawn(
    [
      agentCommand,
      "--print",
      "--output-format",
      "json",
      "--json-schema",
      COMPLETION_CHECK_JSON_SCHEMA,
    ],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );

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

  try {
    const envelope = JSON.parse(output);
    const structured = envelope.structured_output;
    if (structured === undefined || structured === null) {
      return { completed: false, error: "Missing structured_output in response envelope" };
    }
    return { completed: Boolean(structured.completed) };
  } catch (e) {
    return {
      completed: false,
      error: `Failed to parse completion check JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
