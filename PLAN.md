# Plan: Setup testing with bun test runner (#6)

## Summary
Add `bun test` as the test script in `package.json` and create a test file for `parseFrontmatter` covering the main cases.

## Architecture
- `parseFrontmatter` is already exported from `src/primitives/frontmatter.ts` — no source changes needed.
- Test file uses `bun:test` imports (zero-config, auto-discovered by bun).

## Files to modify
- `package.json` — add `"test": "bun test"` to scripts
- `src/primitives/frontmatter.test.ts` — new test file covering valid frontmatter, missing fields, and no frontmatter

## Notes
- `parseFrontmatter` defaults: enabled=true, command=null, timeout=null, description=null, completable=false
