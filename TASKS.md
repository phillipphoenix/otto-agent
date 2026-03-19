# Tasks: Change completion to be a primitive that does a check after each iteration (#25)

- [x] Remove `completable` field from `PrimitiveFrontmatter` interface and all parsing/defaults — file(s): `src/primitives/types.ts`, `src/primitives/frontmatter.ts`
- [x] Remove `STOP_INSTRUCTION` constant, `completable` parameter from `resolveTemplate`, and add `{{ checks }}` inline placeholder support — file(s): `src/resolver.ts`
- [x] Remove `STOP_MARKER` constant and all `agentRequestedStop` handling from the engine — file(s): `src/constants.ts`, `src/engine.ts`
- [x] Add `CompletionCheckEntry` interface and `parseCompletionCheckFrontmatter` — file(s): `src/primitives/types.ts`, `src/primitives/frontmatter.ts`
- [x] Add `discoverCompletionCheck` function — file(s): `src/primitives/discovery.ts`
- [x] Create `src/primitives/completionCheck.ts` with `runCompletionCheck` — file(s): `src/primitives/completionCheck.ts`
- [x] Integrate completion check into `runLoop` (after checks run, call discoverCompletionCheck + runCompletionCheck, break if YES) — file(s): `src/engine.ts`
- [ ] Update task-worker workflow: remove `completable: true`, add `COMPLETION_CHECK.md` — file(s): `.otto/workflows/task-worker/WORKFLOW.md`, `.otto/workflows/task-worker/COMPLETION_CHECK.md`
- [ ] Update example workflow: remove `completable: true`, add `COMPLETION_CHECK.md` — file(s): `.otto/workflows/example/WORKFLOW.md`, `.otto/workflows/example/COMPLETION_CHECK.md`
- [ ] Update improve-readme workflow: remove `completable: true`, add `COMPLETION_CHECK.md` — file(s): `.otto/workflows/improve-readme/WORKFLOW.md`, `.otto/workflows/improve-readme/COMPLETION_CHECK.md`
- [ ] Update issue-orchestrator workflow: remove `completable: true`, add `COMPLETION_CHECK.md` — file(s): `.otto/workflows/issue-orchestrator/WORKFLOW.md`, `.otto/workflows/issue-orchestrator/COMPLETION_CHECK.md`
- [ ] Update enrich-gh-issue workflow: remove `completable: true`, add `COMPLETION_CHECK.md` — file(s): `.otto/workflows/enrich-gh-issue/WORKFLOW.md`, `.otto/workflows/enrich-gh-issue/COMPLETION_CHECK.md`
- [ ] Update `frontmatter.test.ts`: remove `completable` references, add `parseCompletionCheckFrontmatter` unit tests — file(s): `src/primitives/frontmatter.test.ts`
- [ ] Update `engine.test.ts`: remove STOP_MARKER mock result, add completion check mock and integration test that verifies loop stops when check returns YES — file(s): `src/engine.test.ts`
