# Tasks: Auto-update, build pipeline & distribution for Otto CLI (#11)

- [x] Create `src/version.ts` with `CURRENT_VERSION` constant (defaulting to `"0.0.0"` for dev, overridden by `--define` at build time) — file(s): `src/version.ts`
- [x] Create `src/updater.ts` with `fetchLatestVersion()`, `downloadAndApply()`, and `runUpdate()` functions; include Windows `.cmd` shim logic for locked-binary swap — file(s): `src/updater.ts`
- [x] Create `src/ui/UpdateNotice.tsx` Ink component that renders a post-run update notice with version diff and auto-dismisses after 10 seconds — file(s): `src/ui/UpdateNotice.tsx`
- [x] Create `src/commands/update.ts` implementing the `otto update` subcommand that calls `runUpdate()` via Ink and exits without launching the app shell — file(s): `src/commands/update.ts`
- [x] Modify `src/commands/run.ts` to start the update check in the background before rendering and show `UpdateNotice` via a second Ink pass after the main app exits — file(s): `src/commands/run.ts`
- [ ] Modify `src/cli.ts` to add the `update` case and update the help text — file(s): `src/cli.ts`
- [ ] Create `.github/workflows/release.yml` with a `sync-version` job and a `build` matrix job that compiles all 5 platform targets and uploads them to the GitHub Release — file(s): `.github/workflows/release.yml`
