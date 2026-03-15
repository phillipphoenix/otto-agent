---
name: otto-release
description: Create a new GitHub release for Otto Agent with semver tag, categorized release notes, and CHANGELOG.md update. Use this skill whenever the user wants to release, publish, tag, or bump the version of Otto Agent — even if they just say "let's do a release" or "ship it" or "bump the version". Also use when user mentions release notes, changelog, or version bumping in the context of otto-agent.
---

# Otto Agent Release

Create a new GitHub release for Otto Agent with a semver version tag, categorized release notes generated from git history, and an updated CHANGELOG.md.

## Overview

The release process:
1. Determine the new version number
2. Generate categorized release notes from commits since last release
3. Present notes for user approval
4. Update CHANGELOG.md, commit, and push to main
5. Create the GitHub release with tag
6. Optionally wait for the CI build to succeed

## Step 1: Determine Version

Check the latest existing tag:
```bash
git tag --list --sort=-v:refname | head -1
```

If the user hasn't specified a version, ask them:
> The current version is **{latest tag}**. What kind of bump is this?
> - **Patch** (bug fixes): {current} -> {patch bumped}
> - **Minor** (new features): {current} -> {minor bumped}
> - **Major** (breaking changes): {current} -> {major bumped}

The tag format is `v{Major}.{Minor}.{Patch}` (semver).

## Step 2: Generate Release Notes

Get all commits since the last release tag:
```bash
git log {last_tag}..HEAD --oneline
```

Read through the commits and understand the actual changes — don't just list commits. Group related commits into user-facing changes. A single feature that took 5 commits should be one bullet. A commit that touches both logic and UI can be two bullets if the changes are meaningfully distinct, but otherwise keep it as one.

Think from the user's perspective: what changed for them? Not "refactored resolver module" but "improved template resolution reliability".

Categorize into these sections (omit empty sections):

- **🚀 Features** — new capabilities
- **🐛 Fixes** — bug fixes
- **✨ Improvements** — enhancements, refactors, performance gains
- **📖 Documentation** — docs changes
- **🔧 Other** — anything else user-facing (skip internal chore/CI commits unless they affect users)

Format:

```
Otto Agent v{version}

## 🚀 Features
- Brief, user-facing description of the feature

## 🐛 Fixes
- Brief description of what was fixed

## ✨ Improvements
- Brief description of the improvement
```

For the very first release (no previous tag), summarize all initial features instead of trying to categorize individual commits.

## Step 3: Present for Approval

Show the generated release notes to the user and ask for approval:
> Here are the release notes for **v{version}**. Want me to proceed, or would you like to adjust anything?

Wait for explicit approval before continuing.

## Step 4: Update CHANGELOG.md

Before making changes, ensure you're on the `main` branch and it's up to date:
```bash
git checkout main
git pull origin main
```

Update (or create) `CHANGELOG.md` in the repo root. This file is designed to be machine-readable and terminal-friendly — no emojis, clean formatting.

Format:

```markdown
# Changelog

## v{version} (YYYY-MM-DD)

### Features
- Description

### Fixes
- Description

### Improvements
- Description

## v{previous} (YYYY-MM-DD)

...
```

The content mirrors the release notes but without emojis in category headings. If CHANGELOG.md doesn't exist yet, create it. If it does, prepend the new version section after the `# Changelog` heading.

IMPORTANT: Do NOT include a "Co-Authored-By" line in the changelog commit. This is an automated project maintenance commit, not a collaborative code change.

Commit and push:
```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG.md for v{version}"
git push origin main
```

## Step 5: Create GitHub Release

Create the release with tag using `gh`:
```bash
gh release create v{version} --title "v{version}" --notes "{release notes}"
```

Use a HEREDOC for the notes to preserve formatting. This creates the tag and triggers the release GitHub Action which builds multi-platform binaries and attaches them to the release.

## Step 6: Optionally Watch Build

Ask the user:
> The release has been created and the CI build is running. Want me to watch it and report back, or are you good?

If they want to watch:
```bash
# Get the run ID
gh run list --limit 1 --json databaseId --jq '.[0].databaseId'
# Watch it
gh run watch {run_id} --exit-status
```

Report success or failure. If the build fails, show the failed logs:
```bash
gh run view {run_id} --log-failed
```

At the end, provide the release URL: `https://github.com/phillipphoenix/otto-agent/releases/tag/v{version}`
