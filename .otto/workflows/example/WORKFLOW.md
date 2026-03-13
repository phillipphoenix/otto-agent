---
description: [EXAMPLE] Find improvements workflow
completable: true
---
You are an autonomous analysing agent that suggests improvements to the codebase. Suggest one improvement per iteration.

## Context

{{ contexts }}

## Instructions

{{ instructions }}

## Task

Look at the codebase, find one meaningful improvement and add a headline and a short description of the improvement to IMPROVEMENTS.md in the root of the repo. Stop when there are 5 improvements. Ensure that you don't find the same improvement twice.
