# Plan: Change completion to be a primitive that does a check after each iteration (#25)

## Summary

Replace the `completable` / `%%OTTO_STOP%%` self-assessment mechanism with a dedicated `COMPLETION_CHECK.md` primitive per workflow. After each iteration's checks run, if `COMPLETION_CHECK.md` exists, a headless lightweight claude call receives the resolved prompt and responds with `YES` (stop) or `NO` (continue).

## Architecture

**Remove (completable):**
- `completable` field from `PrimitiveFrontmatter` and `WorkflowFrontmatter` (types.ts, frontmatter.ts)
- `STOP_INSTRUCTION` constant and injection in `resolver.ts`
- `STOP_MARKER` constant and `agentRequestedStop` handling in `engine.ts` + `constants.ts`
- `completable: true` from all 5 existing workflow WORKFLOW.md files

**Add (completion check primitive):**
- `CompletionCheckEntry` interface in `types.ts`
- `parseCompletionCheckFrontmatter` in `frontmatter.ts`
- `discoverCompletionCheck(projectDir, workflowName)` in `discovery.ts` — looks for `COMPLETION_CHECK.md` directly in workflow dir (no subfolder)
- `src/primitives/completionCheck.ts` — `runCompletionCheck(entry, agentCommand, contexts, instructions, checkFailuresText?)` resolves prompt via `resolveTemplate`, appends YES/NO instruction, runs headless `claude --print`, parses response
- Engine: after `runChecks`, call `discoverCompletionCheck` + `runCompletionCheck`; if `true` returned, break loop
- Add `{{ checks }}` placeholder support in `resolver.ts` to replace inline position with check failures (instead of always appending at end); keep fallback append if no placeholder
- Add `COMPLETION_CHECK.md` to each workflow directory

## Files to modify

- `src/primitives/types.ts` — remove `completable` from `PrimitiveFrontmatter`; add `CompletionCheckEntry`
- `src/primitives/frontmatter.ts` — remove `completable` parsing; add `parseCompletionCheckFrontmatter`
- `src/primitives/discovery.ts` — add `discoverCompletionCheck`
- `src/primitives/completionCheck.ts` — new file: `runCompletionCheck`
- `src/resolver.ts` — remove `STOP_INSTRUCTION`/`completable` param; add `{{ checks }}` placeholder
- `src/engine.ts` — remove `STOP_MARKER`/`agentRequestedStop`; integrate completion check after checks
- `src/constants.ts` — remove `STOP_MARKER`
- `.otto/workflows/task-worker/WORKFLOW.md` — remove `completable: true`
- `.otto/workflows/task-worker/COMPLETION_CHECK.md` — new file
- `.otto/workflows/example/WORKFLOW.md` — remove `completable: true`
- `.otto/workflows/example/COMPLETION_CHECK.md` — new file
- `.otto/workflows/improve-readme/WORKFLOW.md` — remove `completable: true`
- `.otto/workflows/improve-readme/COMPLETION_CHECK.md` — new file
- `.otto/workflows/issue-orchestrator/WORKFLOW.md` — remove `completable: true`
- `.otto/workflows/issue-orchestrator/COMPLETION_CHECK.md` — new file
- `.otto/workflows/enrich-gh-issue/WORKFLOW.md` — remove `completable: true`
- `.otto/workflows/enrich-gh-issue/COMPLETION_CHECK.md` — new file
- `src/primitives/frontmatter.test.ts` — update tests removing `completable`; add completion check parsing tests
- `src/engine.test.ts` — remove `STOP_MARKER` mock result; add completion check mock; add integration test

## Notes

- `COMPLETION_CHECK.md` lives directly in the workflow dir (not a subdir): `.otto/workflows/<name>/COMPLETION_CHECK.md`
- The completion check is run with `[agentCommand, "--print"]` and prompt passed via stdin; stdout is parsed for `YES`/`NO` (case-insensitive, trimmed)
- `resolveTemplate` is reused for building the completion check prompt (same context/instruction injection), with current iteration's check failures injected
- The `{{ checks }}` resolver addition fixes the existing task-worker placeholder and enables completion checks to position failures inline
- `completable` on `PrimitiveFrontmatter` is removed entirely — no fallback; `WorkflowFrontmatter` is updated accordingly
