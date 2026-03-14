# Plan: Create Github action that runs tests on PR (#9)

## Summary
Create a GitHub Actions workflow that runs `bun test` on every pull request targeting `main`, failing if tests fail.

## Architecture
- New file: `.github/workflows/test.yml`
- Triggered on `pull_request` events targeting `main`
- Uses `ubuntu-latest` runner
- Uses `oven-sh/setup-bun` to install Bun
- Runs `bun install` then `bun test`

## Files to modify
- `.github/workflows/test.yml` — create new workflow file

## Notes
- No existing `.github/` directory — create from scratch
- Pin Bun to `latest` since no local version is pinned in package.json
