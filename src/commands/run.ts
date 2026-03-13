import { join } from "node:path";
import { render } from "ink";
import React from "react";
import { loadConfig } from "../config";
import { createEmitter } from "../events";
import { runLoop } from "../engine";
import type { RunConfig } from "../run-types";
import App from "../ui/App";

interface RunOptions {
  maxIterations?: number;
  delay?: number;
  stopOnError?: boolean;
}

export async function runCommand(
  projectDir: string,
  workflowName: string | undefined,
  options: RunOptions,
): Promise<void> {
  const config = await loadConfig(projectDir);

  const workflow = workflowName ?? config.defaults.workflow ?? "default";

  const workflowFile = join(projectDir, ".otto", "workflows", workflow, "WORKFLOW.md");
  const exists = await Bun.file(workflowFile).exists();

  if (!exists) {
    console.error(`Workflow "${workflow}" not found at ${workflowFile}`);
    console.error("Run `otto list` to see available workflows.");
    process.exit(1);
  }

  const runConfig: RunConfig = {
    workflow,
    maxIterations: options.maxIterations ?? config.defaults.maxIterations,
    delay: options.delay ?? config.defaults.delay,
    timeout: config.defaults.timeout,
    stopOnError: options.stopOnError ?? config.defaults.stopOnError,
    logDir: config.defaults.logDir,
  };

  const emitter = createEmitter();

  const inkApp = render(React.createElement(App, { emitter, config: runConfig }));

  const enginePromise = runLoop(projectDir, config, runConfig, emitter);

  await enginePromise;
  await inkApp.waitUntilExit();
}
