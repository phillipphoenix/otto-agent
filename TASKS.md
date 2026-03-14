# Tasks: Make it possible to set model to use for each workflow (#3)

- [ ] Add `WorkflowFrontmatter` interface extending `PrimitiveFrontmatter` with optional `model` field — file(s): `src/primitives/types.ts`
- [ ] Add `parseWorkflowFrontmatter()` that parses `model:` key in addition to base fields — file(s): `src/primitives/frontmatter.ts`
- [ ] Update engine to use `parseWorkflowFrontmatter()` and pass `workflowFrontmatter.model ?? config.agent.model` to `runAgent()` — file(s): `src/engine.ts`
- [ ] Add unit tests for `parseWorkflowFrontmatter` — file(s): `src/primitives/frontmatter.test.ts`
