import { join } from "node:path";
import { appendFile, rm, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { type EventEmitter, EventType } from "./events";
import type { OttoConfig } from "./config";
import { type RunConfig, RunState, RunStatus } from "./run-types";
import { discoverPrimitives } from "./primitives/discovery";
import { runContexts } from "./primitives/contexts";
import { loadInstructions } from "./primitives/instructions";
import { runChecks } from "./primitives/checks";
import { resolveTemplate } from "./resolver";
import { runAgent } from "./agent";
import { formatDuration } from "./output";
import { STOP_MARKER } from "./constants";
import { parseWorkflowFrontmatter } from "./primitives/frontmatter";

/** Env var used to pass the shared relay directory path to child otto processes. */
export const CHILD_EVENTS_ENV_VAR = "OTTO_CHILD_EVENTS_PATH";

/** Env var tracking nesting depth. */
export const DEPTH_ENV_VAR = "OTTO_DEPTH";

/** How often to poll the relay directory for new events written by child processes (ms). */
const RELAY_POLL_INTERVAL_MS = 300;

async function appendNestedEvent(
  filePath: string,
  type: EventType,
  data: Record<string, unknown>,
): Promise<void> {
  const event = { type, timestamp: Date.now(), data };
  await appendFile(filePath, JSON.stringify(event) + "\n");
}

/** Generate a short 5-char random ID. */
function shortId(): string {
  return crypto.randomUUID().slice(0, 5);
}

export async function runLoop(
  projectDir: string,
  config: OttoConfig,
  runConfig: RunConfig,
  emitter: EventEmitter,
): Promise<void> {
  const state = new RunState(emitter);

  // Determine nesting depth and whether we are the top-level process
  const parentRelayDir = process.env[CHILD_EVENTS_ENV_VAR];
  const isTopLevel = !parentRelayDir;
  state.depth = isTopLevel ? 0 : Number(process.env[DEPTH_ENV_VAR] || "0") + 1;
  state.setStatus(RunStatus.RUNNING);

  // Instance ID for this workflow run (used in event data and relay file naming)
  const instanceId = shortId();

  // Subprocess nested path: append events to own file inside parent's relay dir
  const childEventsTarget =
    runConfig.reportBack && parentRelayDir
      ? join(parentRelayDir, `${runConfig.workflow}-${instanceId}.jsonl`)
      : undefined;

  // Shared relay directory: top-level creates it, nested processes reuse parent's dir
  let relayDir: string;
  let ownsRelayDir: boolean;
  if (isTopLevel) {
    relayDir = await mkdtemp(join(tmpdir(), "otto-relay-"));
    ownsRelayDir = true;
  } else {
    relayDir = parentRelayDir!;
    ownsRelayDir = false;
  }

  // Background watcher: only top-level polls the relay directory
  let stopRelay = false;
  const filePositions = new Map<string, number>();

  const relayPromise = isTopLevel
    ? (async () => {
        while (!stopRelay) {
          await Bun.sleep(RELAY_POLL_INTERVAL_MS);
          try {
            const files = await readdir(relayDir);
            for (const file of files) {
              if (!file.endsWith(".jsonl")) continue;
              const filePath = join(relayDir, file);
              const pos = filePositions.get(filePath) ?? 0;
              try {
                const content = await Bun.file(filePath).text();
                if (content.length > pos) {
                  const newContent = content.slice(pos);
                  filePositions.set(filePath, content.length);
                  for (const line of newContent.split("\n")) {
                    if (!line.trim()) continue;
                    try {
                      emitter.emit(JSON.parse(line));
                    } catch {
                      // skip malformed lines
                    }
                  }
                }
              } catch {
                // file may be temporarily unavailable
              }
            }
          } catch {
            // relay dir may be temporarily unavailable
          }
        }
      })()
    : Promise.resolve();

  // Announce to parent that this nested workflow is starting
  if (childEventsTarget) {
    await appendNestedEvent(childEventsTarget, EventType.NESTED_WORKFLOW_START, {
      workflow: runConfig.workflow,
      depth: state.depth,
      instanceId,
    });
  }

  // Handle SIGINT
  const sigintHandler = () => {
    state.requestStop();
  };
  process.on("SIGINT", sigintHandler);

  let lastIterationFailed = false;

  try {
    while (true) {
      // Check stop
      if (state.isStopRequested()) break;

      // Increment and check max
      state.incrementIteration();
      if (runConfig.maxIterations > 0 && state.iteration > runConfig.maxIterations) {
        break;
      }

      try {
        // Discover and run contexts
        const contextEntries = await discoverPrimitives(projectDir, runConfig.workflow, "contexts");
        const contexts = await runContexts(contextEntries);

        // Discover and load instructions
        const instructionEntries = await discoverPrimitives(projectDir, runConfig.workflow, "instructions");
        const instructions = loadInstructions(instructionEntries);

        // Read WORKFLOW.md template
        const workflowPath = join(
          projectDir,
          ".otto",
          "workflows",
          runConfig.workflow,
          "WORKFLOW.md",
        );
        const workflowFile = Bun.file(workflowPath);
        const rawTemplate = await workflowFile.text();
        const { frontmatter: workflowFrontmatter, body: template } = parseWorkflowFrontmatter(rawTemplate);

        // Build check failures string from previous iteration
        const checkFailuresText =
          state.checkFailures.length > 0 ? state.checkFailures.join("\n\n") : undefined;

        // Resolve template
        const prompt = resolveTemplate(template, contexts, instructions, checkFailuresText, workflowFrontmatter.completable);

        // Run agent, passing the relay dir so nested otto calls can write back
        const agentResult = await runAgent(
          {
            command: config.agent.command,
            args: config.agent.args,
            model: workflowFrontmatter.model ?? config.agent.model,
            timeout: runConfig.timeout,
            extraEnv: {
              [CHILD_EVENTS_ENV_VAR]: relayDir,
              [DEPTH_ENV_VAR]: String(state.depth),
            },
          },
          prompt,
          emitter,
        );

        // Handle agent result
        if (agentResult.timedOut || agentResult.exitCode !== 0) {
          const reason = agentResult.timedOut
            ? "agent timed out"
            : `agent exited with code ${agentResult.exitCode}`;
          state.recordFailure(reason);
          lastIterationFailed = true;
        } else {
          state.recordSuccess();
          lastIterationFailed = false;
        }

        // Check if agent signalled completion
        const agentRequestedStop = agentResult.resultText.includes(STOP_MARKER);

        // Strip stop marker from displayed result text
        const resultText = agentResult.resultText.replaceAll(STOP_MARKER, "").trim();

        // Emit ITERATION_COMPLETE
        emitter.emit({
          type: EventType.ITERATION_COMPLETE,
          timestamp: Date.now(),
          data: {
            iteration: state.iteration,
            status: lastIterationFailed ? "failed" : "succeeded",
            durationMs: agentResult.durationMs,
            resultText,
          },
        });

        // Report this iteration to parent
        if (childEventsTarget) {
          await appendNestedEvent(childEventsTarget, EventType.NESTED_ITERATION_COMPLETE, {
            workflow: runConfig.workflow,
            iteration: state.iteration,
            status: lastIterationFailed ? "failed" : "succeeded",
            durationMs: agentResult.durationMs,
            resultText,
            depth: state.depth,
            instanceId,
          });
        }

        // Stop on error if configured
        if (runConfig.stopOnError && lastIterationFailed) break;

        // Stop if agent signalled task completion
        if (agentRequestedStop) {
          emitter.emit({
            type: EventType.LOG_MESSAGE,
            timestamp: Date.now(),
            data: { level: "info", message: "Agent signalled task completion" },
          });
          break;
        }

        // Discover and run checks
        const checkEntries = await discoverPrimitives(projectDir, runConfig.workflow, "checks");
        const checkResults = await runChecks(checkEntries, emitter);

        // Store check failures for next iteration
        state.checkFailures = checkResults.failed.map(
          (f) => `### ${f.name}\n\n${f.output}`,
        );

        // Delay between iterations
        if (runConfig.delay > 0) {
          await Bun.sleep(runConfig.delay * 1000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emitter.emit({
          type: EventType.LOG_MESSAGE,
          timestamp: Date.now(),
          data: { level: "error", message },
        });
        state.recordFailure(message);
        lastIterationFailed = true;

        emitter.emit({
          type: EventType.ITERATION_COMPLETE,
          timestamp: Date.now(),
          data: {
            iteration: state.iteration,
            status: "failed",
          },
        });

        if (runConfig.stopOnError) break;
      }
    }
  } finally {
    // Stop relay watcher and clean up
    stopRelay = true;
    await relayPromise;
    if (ownsRelayDir) {
      try { await rm(relayDir, { recursive: true, force: true }); } catch {}
    }

    process.off("SIGINT", sigintHandler);

    const finalStatus =
      lastIterationFailed && runConfig.stopOnError
        ? RunStatus.FAILED
        : RunStatus.COMPLETED;
    state.setStatus(finalStatus);

    const durationMs = Date.now() - state.startTime;
    emitter.emit({
      type: EventType.RUN_COMPLETE,
      timestamp: Date.now(),
      data: {
        iterations: state.iteration,
        succeeded: state.succeeded,
        failed: state.failed,
        duration: formatDuration(durationMs),
        durationMs,
        status: finalStatus,
      },
    });

    // Announce to parent that this nested workflow is complete
    if (childEventsTarget) {
      await appendNestedEvent(childEventsTarget, EventType.NESTED_WORKFLOW_COMPLETE, {
        workflow: runConfig.workflow,
        iterations: state.iteration,
        succeeded: state.succeeded,
        failed: state.failed,
        depth: state.depth,
        instanceId,
      });
    }
  }
}
