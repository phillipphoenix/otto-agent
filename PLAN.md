# Plan: Allow setting deny list both globally and for each workflow (#21)

## Summary
Add a `denyList` field to `otto.json` (global) and a `deny` frontmatter key to `WORKFLOW.md` (per-workflow). Merge both lists when running the agent and pass each entry as a `--deny <entry>` CLI flag.

## Architecture
- `src/config.ts`: Add `denyList: z.array(z.string()).default([])` to the `agent` schema object.
- `src/primitives/types.ts`: Add `deny: string[]` to `WorkflowFrontmatter`.
- `src/primitives/frontmatter.ts`: Parse comma-separated or space-separated `deny` values in `parseWorkflowFrontmatter`. The `deny` key is a YAML list-ish format — simplest approach: treat the value as a single entry (one per `deny:` line would require multi-line YAML). Given the simple custom parser, support `deny: value` (single entry per line — user can repeat the key) or parse a comma-separated list.
- `src/engine.ts`: After resolving `workflowFrontmatter`, merge `config.agent.denyList` + `workflowFrontmatter.deny` and pass as additional `--deny <entry>` args to `runAgent`.
- `src/agent.ts`: No changes needed — deny entries are passed via the existing `args` mechanism.
- `src/commands/init.ts`: Add `denyList: [".env", "**/.env"]` to `DEFAULT_CONFIG.agent`.
- `.otto/otto.json`: Add same `denyList` defaults.
- Tests: Add tests in `frontmatter.test.ts` for `deny` parsing; add config schema tests.

## Files to modify
- `src/config.ts` — add `denyList` to agent schema
- `src/primitives/types.ts` — add `deny` to `WorkflowFrontmatter`
- `src/primitives/frontmatter.ts` — parse `deny` key (support repeated keys → array)
- `src/engine.ts` — merge deny lists and pass as `--deny` CLI flags
- `src/commands/init.ts` — add `denyList` defaults to init template
- `.otto/otto.json` — add `denyList` defaults
- `src/primitives/frontmatter.test.ts` — add tests for `deny` parsing
- `src/config.test.ts` (new) — add schema tests for `denyList`

## Notes
- The frontmatter parser is line-based, not full YAML. Support repeated `deny:` lines to build an array.
- Workflow deny list extends (not replaces) global deny list.
- `--dangerously-skip-permissions` remains; Claude Code enforces deny lists even with that flag.
