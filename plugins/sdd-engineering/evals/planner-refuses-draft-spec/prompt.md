---
description: implementation-planner stops on a spec that is not approved instead of writing a plan.
tags: [planner, gate]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering implementation-planner agent to write the implementation plan for the spec below. Give it the spec text exactly as written here.

```markdown
# Spec: Export reviews to CSV   |   Spec ID: SPEC-07   |   Status: draft
Modules: server/modules/reviews

## Problem and why
Team leads copy review findings into spreadsheets by hand.

## Goals / Non-goals
Goal: download all findings of one review as CSV. Non-goal: scheduled exports.

## Acceptance criteria (EARS)
- AC-1: WHEN a user requests GET /reviews/:id/export.csv, the API shall respond with a text/csv body containing one row per finding. Verify: API call.
- AC-2: IF the review does not exist, THEN the API shall respond 404. Verify: API call.
- AC-3: [NEEDS CLARIFICATION: should findings marked "dismissed" be included?]
```
