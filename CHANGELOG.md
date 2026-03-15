# Changelog

## v0.1.1 (2026-03-15)

### Improvements
- New OTTO block lettering banner in the app UI and install scripts, replacing the previous box-drawing style

### Documentation
- Document workflow-level `model` frontmatter option
- Clarify timeout and delay units in `otto.json` configuration
- Add `--report-back` flag and `otto update` command to CLI reference
- Add local development and test commands to docs

## v0.1.0 (2026-03-15)

Initial release. Otto Agent is an autonomous coding agent that runs Claude Code in a configurable loop with validation, self-healing checks, and customizable workflows.

### Features
- CLI commands: `otto run`, `otto init`, `otto list`, and `otto update`
- Workflow system with YAML frontmatter for description, model override, and completable stop conditions
- Three core primitives: Contexts (dynamic data injection), Instructions (static rules), Checks (post-iteration validation)
- Self-healing loop: failed check output fed back into the next iteration
- Global and workflow-scoped primitives with override support
- Template placeholders: `{{ contexts }}`, `{{ instructions }}`, and named variants
- Completable workflows with `%%OTTO_STOP%%` stop marker
- Configurable run loop: max iterations, delay, stop-on-error, timeout
- Configuration via `otto.json`
- Terminal UI with iteration status, tool-use timeline, check results, and run summary
- Self-update from GitHub releases
- Multi-platform builds: Linux (x64/arm64), macOS (x64/arm64), Windows (x64)
- Project scaffolding via `otto init`
