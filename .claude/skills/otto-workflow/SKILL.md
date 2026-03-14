---
name: otto-workflow
description: Create or improve Otto Agent workflows (WORKFLOW.md files) and their scoped primitives (contexts, instructions, checks). Use this skill when the user wants to author a new .otto/workflows/ prompt template, improve or debug an existing workflow (e.g. agent doing too much per iteration, missing stop condition, no scoped context), add or modify workflow-scoped CONTEXT.md/INSTRUCTION.md/CHECK.md files, or design autonomous agent loop patterns. Trigger on mentions of "otto workflow", "WORKFLOW.md", workflow completable/stop conditions, iteration constraints, or scoped primitives. Do NOT trigger for otto CLI development (source code in src/), otto.json configuration, otto installation/setup, GitHub Actions CI workflows, or general shell scripting.
---

# Otto Workflow Skill

You help users create new Otto Agent workflows and improve existing ones. A workflow is a prompt template that drives an autonomous Claude Code loop — each iteration gets fresh context, follows instructions, runs the agent, and validates output with checks.

## Before you start

1. **Read the existing setup.** Run `ls .otto/` to see what's already there. Read `.otto/otto.json` for config. Read existing workflows to understand the project's patterns.
2. **If improving an existing workflow**, read the target `WORKFLOW.md` and any scoped primitives before suggesting changes.
3. **Understand the user's goal.** Ask what the workflow should accomplish, whether it should be completable (finite task) or open-ended (continuous improvement), and what validation matters.

## Creating a new workflow

### Step 1: Design the workflow

Discuss with the user:

- **What does the agent do each iteration?** (e.g., "enrich one GitHub issue", "fix one lint warning", "write one test")
- **Completable or open-ended?** Completable workflows (`completable: true`) signal `%%OTTO_STOP%%` when done. Open-ended ones run until max iterations or Ctrl+C. If completable, **what is the stop condition?** (e.g., "no more unreviewed PRs", "zero lint warnings remain"). Every completable workflow needs an explicit, verifiable condition for when the entire job is done.
- **What context does the agent need?** Dynamic data from shell commands (git log, file listings, API calls) or static text.
- **What rules should the agent follow?** Coding standards, commit conventions, scope constraints.
- **What should be validated after each iteration?** Type checks, linting, tests, build commands.
- **One task per iteration.** This is the most important design principle — the agent should do exactly one meaningful unit of work per iteration, then end that iteration. This keeps iterations focused, debuggable, and composable. Important: "one per iteration" means the agent finishes one item and ends the current iteration — it does NOT mean the workflow stops entirely. The loop continues with the next iteration until the stop condition is met (for completable workflows) or the user stops it.

### Step 2: Create the directory structure

```
.otto/workflows/{workflow-name}/
├── WORKFLOW.md                          # Required: the prompt template
├── contexts/                            # Optional: workflow-scoped contexts
│   └── {context-name}/
│       └── CONTEXT.md
├── instructions/                        # Optional: workflow-scoped instructions
│   └── {instruction-name}/
│       └── INSTRUCTION.md
└── checks/                              # Optional: workflow-scoped checks
    └── {check-name}/
        └── CHECK.md
```

Always create the `WORKFLOW.md` first. Offer to create scoped primitives if the workflow needs context, rules, or validation beyond what the global primitives provide.

### Step 3: Write WORKFLOW.md

Every workflow file has YAML frontmatter and a markdown body:

```markdown
---
description: Short description shown by `otto list`
completable: true
---
You are an autonomous agent that {does X}. Do exactly one {Y} per iteration, then end this iteration.

## Context

{{ contexts }}

## Instructions

{{ instructions }}

## Task

{Detailed task description with clear steps}

## Completion

Signal completion when {explicit, verifiable condition — e.g., "no items remain in the context" or "zero violations remain"}.
```

#### Frontmatter fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `description` | string | — | Shown by `otto list`, describes the workflow |
| `enabled` | boolean | `true` | Set `false` to hide without deleting |
| `completable` | boolean | `false` | Enables `%%OTTO_STOP%%` signalling — agent stops when task is fully complete |

#### Placeholders

- `{{ contexts }}` — injects all contexts alphabetically
- `{{ contexts.name }}` — injects a specific context by name
- `{{ instructions }}` — injects all instructions alphabetically
- `{{ instructions.name }}` — injects a specific instruction by name
- If no placeholders are present, all contexts and instructions are appended automatically

#### Writing a good workflow prompt

The prompt is the tuning knob — it determines everything the agent sees and does. Follow these principles:

1. **Open with a role and scope.** Tell the agent what it is and what it should do in one sentence. E.g., "You are an autonomous documentation agent that improves the README. Make one change per iteration."

2. **One task per iteration, always.** Explicitly constrain the agent to do one unit of work per iteration, then end that iteration. Use phrasing like "do exactly one X per iteration" or "after completing one X, end this iteration." Avoid "stop immediately" — that sounds like terminate the whole loop. The agent should understand it's ending the current iteration, not the entire workflow.

3. **Be specific about the task.** Vague prompts produce vague work. Instead of "improve the code", say "find one function longer than 50 lines, extract a helper, and verify tests still pass."

4. **Include a priority order** when there are multiple things the agent could work on. The agent will pick the highest-priority remaining item each iteration.

5. **Tell the agent what NOT to do.** Explicitly exclude low-value work and shortcuts that bypass the intent. E.g., "Do NOT make cosmetic-only changes such as: rewording for style, synonym swaps, minor punctuation fixes." Also prevent the agent from "fixing" issues by suppressing them — e.g., "Do NOT add eslint-disable comments or suppress warnings" or "Do NOT make tests pass by removing assertions." The agent should solve problems genuinely, not game the checks.

6. **Tell the agent how to verify its own work** before finishing an iteration. E.g., "Run the test suite and confirm all tests pass before committing."

7. **For completable workflows, always include an explicit completion condition in the prompt.** This is critical — without it, the agent won't know when the job is truly done. Write a dedicated "## Completion" section at the end of the Task that states exactly when to signal done. Examples:
   - "Signal completion when the context provides no items to process (all PRs have the `ai-reviewed` label)."
   - "Signal completion when zero eslint-plugin-jsx-a11y violations remain."
   - "Signal completion when no improvements from the above priority categories remain."
   The condition must be verifiable — the agent needs to be able to check it each iteration. The system automatically appends the `%%OTTO_STOP%%` mechanism when `completable: true`, but you must tell the agent *when* to use it.

8. **Include relevant command examples** if the agent needs to use specific CLI tools. E.g., list the exact `gh` commands for GitHub workflows.

9. **For queue-based workflows, use labeling to track progress.** When processing items from a list (issues, PRs, files), the workflow should label or mark each item as processed after completing it (e.g., add an `ai-reviewed` label). The scoped context should filter out already-processed items so the agent never does double work. This is the standard pattern: context filters → agent processes one → agent marks it done → next iteration gets fresh context without that item.

### Step 4: Create scoped primitives (optional)

Offer to create these when the workflow needs:

#### Scoped Contexts — dynamic data specific to this workflow

Example: a workflow that enriches GitHub issues needs the next unprocessed issue. The context filters out already-processed items and returns only one:

```markdown
---
description: Next open issue without ai-enriched label
command: gh issue list --state open --json number,title,body,labels --jq '[.[] | select(.labels | map(.name) | index("ai-enriched") | not)] | if length > 0 then .[0] else empty end'
---
```

For queue-based workflows, always:
- Filter out already-processed items in the context command
- Return only the next item to process (not the full list) — this prevents the agent from trying to process multiple items
- Use labels, tags, or markers to distinguish processed from unprocessed items

Ask: "Does this workflow need any dynamic data that isn't already in the global contexts? For example, file listings, API responses, database state, or filtered git history?"

#### Scoped Instructions — rules specific to this workflow

Example: a documentation workflow might need writing style rules:

```markdown
---
description: Documentation writing style
---
- Write from the user's perspective ("How to X"), not the code's ("The X module")
- Include working, copy-pasteable examples for any described behavior
- Lead with what it does and who it's for, not how it works
```

Ask: "Are there rules or guidelines the agent should follow that only apply to this workflow and not others?"

#### Scoped Checks — validation specific to this workflow

Example: a documentation workflow might validate the docs build:

```markdown
---
description: Documentation builds without warnings
command: mkdocs build --strict
timeout: 60
---
```

Ask: "Should this workflow validate anything beyond the global checks? For example, specific tests, builds, or linting for the files this workflow touches?"

#### Primitive frontmatter reference

All primitives support these fields:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `description` | string | — | Human-readable label |
| `enabled` | boolean | `true` | Set `false` to disable without deleting |
| `command` | string | — | Shell command (required for contexts with dynamic data and all checks) |
| `timeout` | number | — | Seconds before command is killed |

**Naming:** Workflow-scoped primitives override global ones with the same name. Use this to customize global behavior per workflow.

## Improving an existing workflow

When the user wants to improve a workflow:

1. **Read the current WORKFLOW.md** and all its scoped primitives.
2. **Ask what's not working.** Common issues:
   - Agent does too much per iteration → tighten the "one task" constraint
   - Agent does the wrong things → add exclusions or reprioritize
   - Agent misses context → add a scoped context
   - Agent breaks things → add a scoped check
   - Agent never finishes → add `completable: true` with clear stop condition
   - Agent finishes too early → refine the completion condition
3. **Look at existing global primitives** — maybe a global context/instruction/check already exists and just needs to be referenced, or the workflow needs a scoped override.
4. **Propose specific changes** before making them. Explain what you'd change and why.

### Common improvement patterns

- **Add iteration scoping**: If the agent tries to do everything at once, add "Do exactly one X per iteration" as a bold constraint.
- **Add negative constraints**: If the agent wastes iterations on low-value work, explicitly list what it should NOT do.
- **Add a scoped context**: If the agent can't see what it needs, add a command that provides that data.
- **Add a scoped check**: If the agent breaks things the global checks don't catch, add validation.
- **Refine completion**: If a completable workflow stops too early or never stops, adjust the condition.
- **Add priority ordering**: If the agent picks the wrong things to work on, add a numbered priority list.

## Workflow design patterns

These patterns come from real-world workflows that work well:

### The "Enrich One Item" pattern
Process items from a queue one at a time. Each iteration picks one, processes it, marks it done, then ends the iteration. The loop continues until the queue is empty.
- Scoped context: command that lists unprocessed items, filtering out already-processed ones (e.g., by label)
- Labeling: after processing an item, mark it (e.g., add `ai-enriched` label) so the context excludes it next iteration
- Completable: yes, stop condition is "context returns no items" (queue empty)
- The agent should NOT fetch its own list of items — it should only use what the context provides
- Example: enrich GitHub issues, review PRs, process CSV rows, migrate database records

### The "Continuous Improvement" pattern
Open-ended improvement of a codebase aspect. Each iteration finds and fixes one thing, then ends the iteration.
- Priority list of what to look for
- Explicit exclusions of low-value changes
- Completable: yes, stop condition is "no improvements from the priority categories remain" — the agent should signal completion when it can no longer find meaningful work matching the priority list
- Example: improve README, refactor long functions, add missing tests

### The "Research Agent" pattern
Build up a research document iteratively, refining and deepening with each pass.
- Output goes to a single file that the agent reads and builds upon each iteration
- Scoped context: command to read the current research file
- NOT committed to git — local research only
- Completable: depends on whether the research has a finite scope
- Example: competitive analysis, architecture research, growth strategy

### The "Build & Verify" pattern
Create something specific with validation at each step.
- Each iteration adds one component and verifies it works
- Scoped checks to validate the specific thing being built
- Completable: yes, when the thing is fully built
- Example: build a CLI tool feature by feature, create an API endpoint with tests
