# Plan: Make it possible to set model to use for each workflow (#3)

## Summary
Allow per-workflow model override via frontmatter (`model: opus`), falling back to the global model set in `otto.json`.

## Architecture
- Add `WorkflowFrontmatter` extending `PrimitiveFrontmatter` with optional `model` field in types
- Add `parseWorkflowFrontmatter()` that parses `model:` key on top of base fields
- Update engine to use `parseWorkflowFrontmatter()` and pass `workflowFrontmatter.model ?? config.agent.model`
- Add unit tests for the new parser function

## Files to modify
- `src/primitives/types.ts` — add `WorkflowFrontmatter` interface
- `src/primitives/frontmatter.ts` — add `parseWorkflowFrontmatter()` function
- `src/engine.ts` — use `parseWorkflowFrontmatter()` and pass model with fallback
- `src/primitives/frontmatter.test.ts` — add tests for `parseWorkflowFrontmatter`

## Notes
- `model` only applies to workflows; contexts/instructions/checks don't invoke the agent
- `runAgent()` already accepts model as part of `AgentConfig` — no changes needed there
- Global default is `"sonnet"` (defined in `src/config.ts`)
