# Plan: When using the issue-orchestrator the final result text is injected in before the child iteration reports (#23)

## Summary
Swap the render order of the result summary block and the nested iterations block in `IterationView.tsx` so that child iteration rows appear before the parent result text. Add `marginTop={1}` to the result summary to provide visual separation.

## Architecture
Simple JSX render order swap in a single component. No logic changes needed — just move blocks within the return statement.

## Files to modify
- `src/ui/IterationView.tsx` — swap result summary (lines 51–56) and nested iterations (lines 58–65), add marginTop={1} to result summary

## Notes
- No engine, state, or event type changes needed
- The `marginTop={1}` on the result summary provides the blank line separation
