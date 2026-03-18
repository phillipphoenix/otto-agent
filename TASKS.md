# Tasks: Allow setting deny list both globally and for each workflow (#21)

- [x] Add `denyList` field to `OttoConfigSchema` agent section — file: `src/config.ts`
- [x] Add `deny` field to `WorkflowFrontmatter` interface — file: `src/primitives/types.ts`
- [ ] Parse `deny` key (supporting repeated lines → array) in `parseWorkflowFrontmatter` — file: `src/primitives/frontmatter.ts`
- [ ] Merge global + workflow deny lists and pass as `--deny` flags when invoking the agent — file: `src/engine.ts`
- [ ] Add `denyList` with sensible defaults to the init template — file: `src/commands/init.ts`
- [ ] Update repo's own `.otto/otto.json` with `denyList` defaults — file: `.otto/otto.json`
- [ ] Add unit tests for `deny` frontmatter parsing — file: `src/primitives/frontmatter.test.ts`
- [ ] Add config schema unit tests for `denyList` — file: `src/config.test.ts`
