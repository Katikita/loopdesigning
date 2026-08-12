---
name: loop-designing
description: Run or resume a persistent human-in-the-loop design harness that turns a requirement and visual references into exactly three image concepts, pauses for human critique and selection, implements the chosen direction across explicitly authorized delivery targets, evaluates it against project rules and approved design memory, pauses for a final human verdict, and records reusable learning. Use when the user asks for Loop Designing, wants concept options before implementation, requests critique-driven UI generation, wants a design evaluated against remembered taste, or wants to resume a staged design run.
---

# Loop Designing

Operate a persisted design state machine. Use `scripts/loop.mjs` for every transition; never simulate a transition only in conversation.

Require Node.js 18 or newer and access to a bitmap image-generation capability.

## Initialize or resume

1. Locate `loop-designing.config.json` in the host workspace root.
2. If it is missing, run `node <skill-dir>/scripts/loop.mjs init` and customize the generated config and `project-context.md` scaffold. When the clean-worktree guard is enabled, ask the user to commit the generated files or explicitly authorize `--allow-dirty`; never commit automatically.
3. Run `node <skill-dir>/scripts/loop.mjs status` before acting. Resume a non-terminal run unless the user explicitly requests a new requirement.
4. For a new run, recommend gathering project background in `project-context.md`: product purpose, primary users, current experience, product and technical constraints, and success criteria. If it is missing or unfilled, invite the user to provide those details; never infer them from a screenshot or reference. This is recommended context, not a start gate: when the user declines, proceed with the background they supplied.
5. Inventory these optional design-context groups before saving the requirement:
   - **Design system:** `tokens`, `typography`, `layout`, `components`
   - **Reference screens:** `reference-screen`
   - **Design rules:** `approved-decisions`, `rejected-patterns`, `accessibility`
   Present the supplied items and the optional gaps. If no source is supplied, pause and ask the user for one concrete local file or HTTP(S) URL; time pressure does not waive this start requirement. Never invent missing context. Warn that one source is sparse, but proceed when the user supplies it. Run:

   ```bash
   node <skill-dir>/scripts/loop.mjs start --requirement-file <path> --design-context <kind=source> [--design-context <kind=source>] [--tag <tag>]
   ```

6. Read the generated `context/context.md`. It contains the snapshotted project rules and retrieved approved and rejected memory.

If the clean-worktree guard blocks a start, never reset or stash user work. Use `--allow-dirty` only when the user confirms the existing changes belong to the run.

Read these references when their stage applies:

- [references/configuration.md](references/configuration.md) when initializing or changing project inputs and checks.
- [references/run-contract.md](references/run-contract.md) when starting, resuming, registering artifacts, or routing iteration.
- [references/evaluation-contract.md](references/evaluation-contract.md) before evaluation.
- [references/memory-contract.md](references/memory-contract.md) before proposing or approving memory.

## Execute the stages

### 1. Generate concepts

- Use an image-generation capability. Do not implement UI code during this stage.
- Generate exactly three genuinely different bitmap concepts from the same requirement, references, and retrieved context.
- Give each concept one declared hypothesis and preserve its exact generation prompt.
- Persist the three artifacts and register their manifest with `concepts --run <id> --manifest <path>`.
- Show all three concepts and stop. Never select on the user's behalf.

### 2. Record human critique

- Preserve the user's words verbatim in the critique notes.
- Use `critique --decision select` with one concept ID, or `critique --decision iterate` to generate three new concepts.
- Never implement before a human selection exists in run state.

### 3. Implement the selection

- Implement only the selected concept and explicit critique. Treat it as an unapproved candidate until the final verdict.
- Classify every named external system as either `reference-only` or `delivery-target`.
- When the user explicitly authorizes a delivery target, implement there and capture stable IDs, revisions, URLs, build status, and visual evidence where available.
- If a named system's role is ambiguous, resolve it before implementation. Never infer publication permission from a reference alone.
- Follow the host workspace's product canon, code rules, and design system.
- Persist every named system in a targets manifest, including its role, authorization source, completion status, stable IDs, and publication evidence. Use an empty `targets` array when no external system is involved.
- Capture a summary and evidence for every authorized target. Show the preview or visual evidence to the human before registering the implementation, and incorporate any feedback they give at that point.
- Once the evidence is ready for evaluation, run `implemented --run <id> --summary-file <path> --targets-manifest <path> [--evidence <path>]`.
- If the human rejects the preview after registration but before evaluation, preserve their words in a notes file and run `revise-implementation --run <id> --notes-file <path>`. This returns to implementation without requiring command approval or evaluating a candidate already known to be wrong.

### 4. Evaluate

- Inspect the exact configured check commands, timeout, and environment allowlist. If checks exist and the run has no approval for their exact fingerprint, show the fingerprint returned by `evaluate --run <id>` and obtain explicit human approval before rerunning with `--checks-sha256 <fingerprint>`. Approval authorizes those exact commands to run with the user's filesystem permissions.
- Run the approved evaluation to build the evaluation packet. The harness reuses an existing approval only while the fingerprint is unchanged; a changed command, timeout, or environment allowlist requires new approval.
- Read the complete packet and inspect visual evidence or the running interface when UI changed.
- Write an evidence-backed report and an exact memory proposal using the reference schemas.
- Register them with `record-evaluation --run <id> --report <path> --memory-proposal <path>`. Use `{ "entries": [] }` when there is no reusable learning.
- Present the evaluation and exact proposal, then stop. The evaluator cannot approve its own work.

### 5. Record the final verdict

- Record `pass`, `retry-evaluation`, `iterate-implementation`, `iterate-concepts`, or `archive` with `verdict`.
- A passing verdict must include `--memory-action approve` or `--memory-action skip`.
- Promote only the proposal shown before the verdict. Never convert raw conversation or evaluator opinion into canonical memory.
- Route an invalid check configuration, transient check-environment failure, or faulty evaluation report to `retry-evaluation`; this preserves the selected concept and implementation and creates a new evaluation attempt. Route implementation defects back to implementation and direction defects back to concepts.

## Non-negotiable gates

- Use bitmap image concepts; do not substitute coded mockups.
- Do not cross either human gate without explicit input.
- Do not treat passing checks as design approval.
- Do not execute configured checks without fingerprint-bound human approval.
- Preserve rejected artifacts, critique, failed checks, and prior iterations.
- Do not silently broaden tag- or project-scoped learning into global memory.
- Do not commit, push, deploy, publish, or modify an external system unless the user explicitly authorizes that target.
