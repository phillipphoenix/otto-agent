# Plan: Make nested workflows report back for better UX and reporting (#13)

## Summary
When an outer workflow invokes `otto run inner-workflow` (via the agent's bash tool), the inner workflow's iteration progress should be surfaced in the outer workflow's UI. A `--report-back` flag enables this mode; without it, inner workflows are silent to the outer loop.

## Architecture

### Same-process path
`runLoop()` gains an optional `parentEmitter` parameter. When provided (and `reportBack: true` in RunConfig), the inner loop emits `NESTED_WORKFLOW_START`, `NESTED_ITERATION_COMPLETE`, and `NESTED_WORKFLOW_COMPLETE` to the parent emitter directly. This is the testable, clean path.

### Subprocess path (realistic usage)
When the agent runs `otto run --report-back inner-workflow` as a Bash tool call, the inner process is a separate OS process. To bridge emitters across the process boundary:

1. The outer `runLoop` creates a temp JSONL event file (`/tmp/otto-events-<random>.jsonl`) and starts a background polling watcher.
2. It passes the file path via an env var (`OTTO_CHILD_EVENTS_PATH`) to the `claude` subprocess (via `AgentConfig.extraEnv`).
3. The inner otto process (when `--report-back` is set and `OTTO_CHILD_EVENTS_PATH` is in env) appends JSONL events to that file after each iteration.
4. The outer watcher reads new lines and emits them as `NESTED_*` events on the outer emitter.

### UI
`IterationData` gains a `nestedIterations` array. The three new event types populate it. `IterationView` renders nested iterations indented under the current outer iteration.

## Files to modify
- `src/events.ts` — add `NESTED_WORKFLOW_START`, `NESTED_WORKFLOW_COMPLETE`, `NESTED_ITERATION_COMPLETE` event types
- `src/run-types.ts` — add `reportBack?: boolean` to RunConfig; add `depth: number`, `parentIteration?: number` to RunState
- `src/agent.ts` — add `extraEnv?: Record<string, string>` to AgentConfig; pass to Bun.spawn env
- `src/engine.ts` — accept `parentEmitter?: EventEmitter`; set up JSONL relay for subprocess case; emit nested events when running as child; pass child events path to agent config
- `src/commands/run.ts` — add `--report-back` CLI option; set in RunConfig; detect `OTTO_CHILD_EVENTS_PATH` env var when running as inner workflow
- `src/ui/App.tsx` — handle new event types; extend `IterationData` with `nestedIterations`
- `src/ui/IterationView.tsx` — render nested iterations indented

## New files
- `src/engine.test.ts` — unit tests for nested runLoop with parentEmitter

## Notes
- Report-back is off by default to avoid noise
- The JSONL relay polling interval is 300ms — acceptable latency for UX feedback
- Cleanup of temp event files happens in the `finally` block of the outer runLoop
- Inner iterations show: workflow name, iteration number, status, and brief result text
- Depth tracking prevents runaway nesting (max depth could be enforced later)
