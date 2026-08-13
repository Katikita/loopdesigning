# Pre-merge Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every verified Important pre-merge finding and complete a current-artifact human-gated E2E run before merging the public beta into `main`.

**Architecture:** Harden the existing dependency-free Node CLI at its current boundaries. Keep Git capture literal, validate canonical configuration destinations before mutation, make `start` transactional, and derive the release artifact set from the installable skill’s local Markdown links plus required scripts. Preserve the existing state machine, human gates, and Node 18 floor.

**Tech Stack:** Node.js 18+ standard library, Git, Markdown, GitHub Actions.

## Global Constraints

- No package dependencies.
- No weakening of human concept, command-approval, verdict, memory, provenance, or visual-fidelity gates.
- All behavior fixes require a failing regression before production edits.
- A failed `start` must not leave a run or create canonical memory files.
- Approved and rejected memory must resolve to different canonical destinations.
- Release validation must reject missing, empty, or symlinked runtime artifacts.

---

### Task 1: Preserve literal Git provenance

**Files:**
- Modify: `loop-designing/scripts/test-harness.mjs`
- Modify: `loop-designing/scripts/loop.mjs`

- [ ] Add a tracked modification under `runsA/` while `runsDir` is `runs*`, register an implementation, and assert provenance contains `runsA`.
- [ ] Run the harness and observe the provenance assertion fail.
- [ ] Change Git exclusion pathspecs to `:(exclude,literal)`.
- [ ] Run the harness and observe it pass.
- [ ] Commit with `fix: preserve literal provenance paths`.

### Task 2: Validate memory destinations and make start transactional

**Files:**
- Modify: `loop-designing/scripts/test-harness.mjs`
- Modify: `loop-designing/scripts/loop.mjs`

- [ ] Add regressions rejecting identical and in-workspace symlink-aliased approved/rejected memory stores.
- [ ] Add a regression where a configured context path escapes through a symlink; assert no run directory and no memory files remain.
- [ ] Run the harness and observe all new assertions fail for the intended reasons.
- [ ] Compare memory stores by canonical destination, preflight configured context paths, avoid creating empty memory files at start, and roll back the whole run directory on any post-creation failure.
- [ ] Run the harness and observe it pass.
- [ ] Commit with `fix: make run startup transactional`.

### Task 3: Validate the complete installable skill

**Files:**
- Modify: `scripts/test-release.mjs`
- Modify: `scripts/validate-skill.mjs`

- [ ] Add generated release fixtures that remove, empty, or replace with a symlink every required script and reference linked by `SKILL.md`.
- [ ] Run the release regression and observe missing and empty reference cases pass incorrectly.
- [ ] Require nonempty regular runtime files and validate every local Markdown link in `SKILL.md` remains inside the skill and resolves to a nonempty regular file.
- [ ] Run release regression, validator, and clean-install verification and observe all pass.
- [ ] Commit with `fix: validate complete skill artifacts`.

### Task 4: Complete final QA and human-gated E2E

**Files:**
- Create only disposable consumer artifacts outside the installable skill.

- [ ] Run syntax checks, harness, release regression, validator, clean-install verifier, and `git diff --check origin/main..HEAD`.
- [ ] Push the fixed release branch and require GitHub CI success on Node 18, 22, and 24.
- [ ] Copy the final `loop-designing/` folder into a fresh disposable product workspace.
- [ ] Complete one real run with a human concept choice, implementation preview decision, final verdict, and explicit memory action.
- [ ] Request a final read-only review over `origin/main..HEAD`; resolve all verified Critical and Important findings.
- [ ] Open a pull request into `main`, verify its required checks, merge it, and confirm the release head is an ancestor of `origin/main`.
