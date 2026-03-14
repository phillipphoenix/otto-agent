import { join } from "node:path";
import { appendFile, unlink } from "node:fs/promises";
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

/** Env var used to pass the parent's JSONL relay file path to child otto processes. */
export const CHILD_EVENTS_ENV_VAR = "OTTO_CHILD_EVENTS_PATH";

/** How often to poll the JSONL relay file for new events written by child processes (ms). */
const RELAY_POLL_INTERVAL_MS = 300;

async function appendNestedEvent(
  filePath: string,
  type: EventType,
  data: Record<string, unknown>,
): Promise<void> {
  const event = { type, timestamp: Date.now(), data };
  await appendFile(filePath, JSON.stringify(event) + "\n");
}

export async function runLoop(
  projectDir: string,
  config: OttoConfig,
  runConfig: RunConfig,
  emitter: EventEmitter,
  parentEmitter?: EventEmitter,
): Promise<void> {
  const state = new RunState(emitter);
  state.depth = parentEmitter || process.env[CHILD_EVENTS_ENV_VAR] ? 1 : 0;
  state.setStatus(RunStatus.RUNNING);

  // Same-process nested path: emit directly to parent emitter
  const emitToParent = !!(parentEmitter && runConfig.reportBack);

  // Subprocess nested path: append events to parent's relay file
  const childEventsTarget = runConfig.reportBack ? process.env[CHILD_EVENTS_ENV_VAR] : undefined;

  // Create our own relay file for child otto processes spawned via agent bash calls
  const ownRelayPath = join(tmpdir(), `otto-events-${crypto.randomUUID()}.jsonl`);
  await Bun.write(ownRelayPath, "");

  // Background watcher: poll relay file and re-emit child events on our emitter
  let stopRelay = false;
  let relayPosition = 0;
  const relayPromise = (async () => {
    while (!stopRelay) {
      await Bun.sleep(RELAY_POLL_INTERVAL_MS);
      try {
        const content = await Bun.file(ownRelayPath).text();
        if (content.length > relayPosition) {
          const newContent = content.slice(relayPosition);
          relayPosition = content.length;
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
  })();

  // Announce to parent that this nested workflow is starting
  if (emitToParent) {
    parentEmitter!.emit({
      type: EventType.NESTED_WORKFLOW_START,
      timestamp: Date.now(),
      data: { workflow: runConfig.workflow },
    });
  } else if (childEventsTarget) {
    await appendNestedEvent(childEventsTarget, EventType.NESTED_WORKFLOW_START, {
      workflow: runConfig.workflow,
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

        // Run agent, passing the relay file path so nested otto calls can write back
        const agentResult = await runAgent(
          {
            command: config.agent.command,
            args: config.agent.args,
            model: workflowFrontmatter.model ?? config.agent.model,
            timeout: runConfig.timeout,
            extraEnv: { [CHILD_EVENTS_ENV_VAR]: ownRelayPath },
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
        const nestedIterationData = {
          workflow: runConfig.workflow,
          iteration: state.iteration,
          status: lastIterationFailed ? "failed" : "succeeded",
          durationMs: agentResult.durationMs,
          resultText,
        };
        if (emitToParent) {
          parentEmitter!.emit({
            type: EventType.NESTED_ITERATION_COMPLETE,
            timestamp: Date.now(),
            data: nestedIterationData,
          });
        } else if (childEventsTarget) {
          await appendNestedEvent(childEventsTarget, EventType.NESTED_ITERATION_COMPLETE, nestedIterationData);
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
    // Stop relay watcher and clean up temp file
    stopRelay = true;
    await relayPromise;
    try { await unlink(ownRelayPath); } catch {}

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
    const nestedCompleteData = {
      workflow: runConfig.workflow,
      iterations: state.iteration,
      succeeded: state.succeeded,
      failed: state.failed,
    };
    if (emitToParent) {
      parentEmitter!.emit({
        type: EventType.NESTED_WORKFLOW_COMPLETE,
        timestamp: Date.now(),
        data: nestedCompleteData,
      });
    } else if (childEventsTarget) {
      await appendNestedEvent(childEventsTarget, EventType.NESTED_WORKFLOW_COMPLETE, nestedCompleteData);
    }
  }
}
