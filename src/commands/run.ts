import { join } from "node:path";
import { render } from "ink";
import React from "react";
import { loadConfig } from "../config";
import { createEmitter } from "../events";
import { runLoop, CHILD_EVENTS_ENV_VAR } from "../engine";
import type { RunConfig } from "../run-types";
import App from "../ui/App";
import UpdateNotice from "../ui/UpdateNotice";
import { fetchLatestVersion, type UpdateResult } from "../updater";
import { currentVersion } from "../version";

interface RunOptions {
  maxIterations?: number;
  delay?: number;
  stopOnError?: boolean;
  reportBack?: boolean;
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

  // Enable report-back if explicitly requested via CLI flag or if the parent
  // process has set the child events env var (meaning we are a nested workflow).
  const reportBack = options.reportBack || !!process.env[CHILD_EVENTS_ENV_VAR];

  const runConfig: RunConfig = {
    workflow,
    maxIterations: options.maxIterations ?? config.defaults.maxIterations,
    delay: options.delay ?? config.defaults.delay,
    timeout: config.defaults.timeout,
    stopOnError: options.stopOnError ?? config.defaults.stopOnError,
    logDir: config.defaults.logDir,
    reportBack,
  };

  const emitter = createEmitter();

  // Start update check in background — must not block or throw.
  const updateCheckPromise: Promise<UpdateResult> = fetchLatestVersion()
    .then((latestTag) => {
      if (!latestTag) return { status: "error" as const, message: "Could not fetch version." };
      const latest = latestTag.replace(/^v/, "");
      const cur = currentVersion.replace(/^v/, "");
      const parse = (v: string) => v.split(".").map(Number) as [number, number, number];
      const [aMaj, aMin, aPatch] = parse(cur);
      const [bMaj, bMin, bPatch] = parse(latest);
      const newer =
        bMaj !== aMaj ? bMaj > aMaj : bMin !== aMin ? bMin > aMin : bPatch > aPatch;
      if (!newer) return { status: "up-to-date" as const, version: cur };
      // Return a pending-update result so the notice renders after exit.
      return {
        status: "updated" as const,
        from: cur,
        to: latest,
        windowsDeferred: process.platform === "win32",
      };
    })
    .catch(() => ({ status: "error" as const, message: "Update check failed." }));

  const inkApp = render(React.createElement(App, { emitter, config: runConfig }));

  const enginePromise = runLoop(projectDir, config, runConfig, emitter);

  await enginePromise;
  await inkApp.waitUntilExit();

  // Show update notice after the main app exits (second Ink pass).
  const updateResult = await updateCheckPromise;
  if (updateResult.status === "updated") {
    const noticeApp = render(React.createElement(UpdateNotice, { result: updateResult }));
    await noticeApp.waitUntilExit();
  }
}
