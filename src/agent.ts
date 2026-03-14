import { EventType, type Event, type EventEmitter } from "./events";

export interface AgentConfig {
  command: string;
  args: string[];
  model?: string;
  timeout?: number | null;
  extraEnv?: Record<string, string>;
}

export interface AgentResult {
  resultText: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

function makeEvent(type: EventType, data: Record<string, unknown>): Event {
  return { type, timestamp: Date.now(), data };
}

/** Drain a ReadableStream into a string. */
async function collectOutput(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

export async function runAgent(
  config: AgentConfig,
  prompt: string,
  emitter?: EventEmitter,
): Promise<AgentResult> {
  const cmd: string[] = [
    config.command,
    ...config.args,
    "--output-format",
    "stream-json",
    "--verbose",
  ];

  if (config.model) {
    cmd.push("--model", config.model);
  }

  const startTime = Date.now();
  let timedOut = false;
  let resultText = "";

  const proc = Bun.spawn(cmd, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: config.extraEnv ? { ...process.env, ...config.extraEnv } : undefined,
  });

  proc.stdin.write(prompt);
  proc.stdin.end();

  // Collect stderr in the background (for debugging, not included in result)
  const stderrPromise = collectOutput(proc.stderr as ReadableStream<Uint8Array>);

  // Read stdout line-by-line, parsing streaming JSON
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    // Timeout check
    if (config.timeout && Date.now() - startTime > config.timeout) {
      timedOut = true;
      proc.kill();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);
        handleMessage(msg, emitter, (text) => {
          resultText = text;
        });
      } catch {
        // Non-JSON line, skip
      }
    }
  }

  // Process any remaining data in the buffer
  if (buffer.trim()) {
    try {
      const msg = JSON.parse(buffer);
      handleMessage(msg, emitter, (text) => {
        resultText = text;
      });
    } catch {
      // skip
    }
  }

  // Wait for process exit and stderr collection
  const exitCode = await proc.exited;
  await stderrPromise;

  const durationMs = Date.now() - startTime;

  return {
    resultText,
    exitCode: timedOut ? 1 : exitCode,
    timedOut,
    durationMs,
  };
}

/** Summarise a tool_use block into a human-readable one-liner. */
function describeToolUse(block: Record<string, unknown>): string {
  const name = block.name as string;
  const input = (block.input ?? {}) as Record<string, unknown>;

  switch (name) {
    case "Read":
      return `Read ${input.file_path ?? ""}`;
    case "Write":
      return `Write ${input.file_path ?? ""}`;
    case "Edit":
      return `Edit ${input.file_path ?? ""}`;
    case "Glob":
      return `Glob ${input.pattern ?? ""}`;
    case "Grep":
      return `Grep "${input.pattern ?? ""}"`;
    case "Bash": {
      const cmd = (input.command as string) ?? "";
      const short = cmd.length > 80 ? cmd.slice(0, 77) + "..." : cmd;
      return `Bash: ${short}`;
    }
    case "Agent":
      return `Agent: ${(input.description as string) ?? "sub-task"}`;
    default:
      return `${name}`;
  }
}

function handleMessage(
  msg: Record<string, unknown>,
  emitter: EventEmitter | undefined,
  setResult: (text: string) => void,
): void {
  if (msg.type === "result") {
    const text = typeof msg.result === "string" ? msg.result : "";
    setResult(text);
    return;
  }

  if (msg.type === "assistant" && Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "text" && typeof block.text === "string") {
        emitter?.emit(
          makeEvent(EventType.AGENT_ACTIVITY, {
            kind: "text",
            text: block.text,
          }),
        );
      } else if (block.type === "tool_use" && typeof block.name === "string") {
        emitter?.emit(
          makeEvent(EventType.AGENT_ACTIVITY, {
            kind: "tool",
            text: describeToolUse(block),
            tool: block.name,
          }),
        );
      }
    }
  }
}
