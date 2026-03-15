# Plan: Add version flag to CLI (#17)

## Summary
Add `--version` / `-v` flag to the otto CLI so users can run `otto --version` to see the installed version.

## Architecture
`src/version.ts` already exports `currentVersion` (injected at build time, falls back to `"0.0.0"` in dev). The only change needed is in `src/cli.ts`: add `version` to the `parseArgs` options and handle it before dispatching to subcommands.

## Files to modify
- `src/cli.ts` — add `--version`/`-v` option to `parseArgs`, handle it early (print version + exit 0), update help text

## Notes
- Short flag `-v` is available (not already used).
- Version should be printed as a bare string, e.g. `0.1.1`, consistent with other CLI tools.
- Handle before the "no positionals → show help" branch so `otto --version` works without a subcommand.
