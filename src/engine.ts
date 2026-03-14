import { join } from "node:path";
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

export async function runLoop(
  projectDir: string,
  config: OttoConfig,
  runConfig: RunConfig,
  emitter: EventEmitter,
): Promise<void> {
  const state = new RunState(emitter);
  state.setStatus(RunStatus.RUNNING);

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

        // Run agent
        const agentResult = await runAgent(
          {
            command: config.agent.command,
            args: config.agent.args,
            model: workflowFrontmatter.model ?? config.agent.model,
            timeout: runConfig.timeout,
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
  }
}
