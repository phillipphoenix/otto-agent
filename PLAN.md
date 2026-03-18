# Plan: Issue orchestrator should skip assigned issues and issues with existing PRs (#19)

## Summary
Update the `ai-ready-issues` context command to filter out issues that are already assigned or have linked open PRs, preventing duplicate work.

## Architecture
The context command in `CONTEXT.md` uses a `command:` frontmatter field parsed by a custom line-by-line parser (`src/primitives/frontmatter.ts`). Multi-line YAML is not supported, so the entire filter logic must fit on one line using shell piping.

**Approach:**
1. Add `--no-assignee` to the `gh issue list` call to exclude assigned issues
2. Pipe results through a `while` loop that checks each candidate with `gh pr list --search "#<num>" --state open` and outputs the first with no linked PRs

The WORKFLOW.md documentation section also lists this command and should be updated to stay accurate.

## Files to modify
- `.otto/workflows/issue-orchestrator/contexts/ai-ready-issues/CONTEXT.md` — update command to add `--no-assignee` and PR existence check
- `.otto/workflows/issue-orchestrator/WORKFLOW.md` — update the documented command in "GitHub CLI commands used"

## Notes
- The frontmatter parser is custom and line-based; no multi-line YAML block scalars
- `gh pr list --search "#<number>"` searches PR titles and bodies for the issue reference; covers most common linking conventions
- The while-loop approach short-circuits on first match, so it is efficient for the common case of few candidates
