# Plan: When running the project during development, assume the latest version (#20)

## Summary
Fix the dev fallback version in `src/version.ts` from `"0.0.0"` to the version from `package.json`, preventing spurious update prompts during development.

## Architecture
- Import `package.json` using Bun's native JSON import syntax
- Use `pkg.version` as the fallback when `CURRENT_VERSION` is not injected at build time
- The build-time injection still takes precedence in compiled binaries

## Files to modify
- `src/version.ts` — replace `"0.0.0"` fallback with `pkg.version` from package.json import

## Notes
- Bun supports `import pkg from "../package.json" with { type: "json" }` natively
- Relative path from `src/version.ts` to `package.json` is `../package.json`
- Only affects dev mode; production binaries use injected `CURRENT_VERSION`
