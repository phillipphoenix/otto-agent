# Tasks: Make nested workflows report back for better UX and reporting (#13)

- [x] Add NESTED_WORKFLOW_START, NESTED_WORKFLOW_COMPLETE, NESTED_ITERATION_COMPLETE event types — file(s): `src/events.ts`
- [x] Extend RunConfig with reportBack flag and RunState with depth/parentIteration — file(s): `src/run-types.ts`
- [x] Add extraEnv to AgentConfig and pass it to the claude subprocess — file(s): `src/agent.ts`
- [x] Modify runLoop to accept parentEmitter, emit nested events, manage JSONL relay file for subprocess IPC, and pass child events path to agent — file(s): `src/engine.ts`
- [x] Add --report-back CLI option and wire up OTTO_CHILD_EVENTS_PATH detection for inner workflow — file(s): `src/commands/run.ts`
- [x] Extend IterationData with nestedIterations and handle new event types in App — file(s): `src/ui/App.tsx`
- [x] Render nested iterations indented in IterationView — file(s): `src/ui/IterationView.tsx`
- [ ] Write unit tests for nested runLoop with parentEmitter (with and without reportBack flag) — file(s): `src/engine.test.ts`
