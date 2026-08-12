# README Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a new Codex user a compelling, accurate product promise and the shortest reliable path from repository clone to a valid first Loop Designing run.

**Architecture:** Rewrite the root `README.md` as progressive disclosure: hook, install, first run, expected experience, optional project context, and only then advanced CLI, safety, and contributor material. Keep the repository description as a short companion promise and verify all setup claims against the existing CLI, configuration contract, release validator, clean-install verifier, and harness.

**Tech Stack:** Markdown, Git, Node.js 18+ standard library, Codex standalone skills.

## Global Constraints

- Describe improvement over time as scoped, human-approved alignment—not model retraining or guaranteed improvement.
- Keep `$loop-designing` as the primary user interface and direct CLI commands as advanced usage.
- Require at least one concrete local workspace file or HTTP(S) URL to start a run.
- Treat richer project and design context as recommended rather than mandatory.
- Treat `design.md` and other configured context files as product canon that outranks learned memory.
- Keep the public-beta and independent-project disclosures.

---

### Task 1: Rewrite and publish setup documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `loop-designing/SKILL.md`, `loop-designing/references/configuration.md`, `loop-designing/references/run-contract.md`, and the existing release scripts.
- Produces: a quick-start-first README and the GitHub About description `Train an AI design collaborator over time with three visual concepts, human critique, fidelity QA, evaluation, and approved memory for Codex.`

- [ ] **Step 1: Record the pre-change setup-document baseline**

Run:

```bash
rg -n '^## (Quick start|1\. Install|2\. Start your first design loop|Add project context|Advanced CLI)' README.md
```

Expected: no complete quick-start sequence is present near the top of the existing README.

- [ ] **Step 2: Rewrite `README.md`**

Use this exact top-level order:

```text
# Loop Designing
two-sentence hook
public-beta disclosure
## What it gives you
## Quick start
### 1. Check requirements
### 2. Install the skill
### 3. Start your first design loop
## What happens during a run
## Give it your design context
## How memory improves alignment
## Advanced CLI
## Safety and control
## Validate and contribute
## Repository structure
## Current boundaries
```

The opening must connect the hook to the bounded mechanism:

```markdown
**Train an AI design collaborator that becomes more aligned with your product over time.** Loop Designing turns every requirement into three visual concepts, carries human critique into implementation, checks the result against the chosen concept, and saves only the design lessons you explicitly approve.

It does not retrain the underlying model. It creates a persistent, inspectable design loop for Codex, so approved preferences and rejected patterns can inform later work without overriding your current requirement or product canon.
```

The first-run prompt must use a real workspace-relative reference placeholder and explain that the path must exist:

```text
$loop-designing

Start a new design run.

Requirement:
Design a focused mobile account overview that makes available cash and upcoming payments easy to scan.

Reference:
- ./references/account-layout.png
```

Show `design.md` in `contextFiles` and explicitly state the authority order: current requirement and human direction, configured product canon, project/tag/global approved memory, and rejected memory as warnings.

- [ ] **Step 3: Verify required README content and obsolete positioning**

Run:

```bash
rg -n '^## (Quick start|What happens during a run|Give it your design context|How memory improves alignment|Advanced CLI|Validate and contribute)' README.md
rg -n 'Node\.js 18|\.agents/skills|\$loop-designing|design\.md|approved\.jsonl|rejected\.jsonl|does not retrain|public beta' README.md
```

Expected: every required section and setup claim is found. Read the matches to confirm each statement is in its intended section.

- [ ] **Step 4: Validate commands and the installable artifact**

Run:

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --check loop-designing/scripts/loop.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node loop-designing/scripts/test-harness.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/test-release.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/validate-skill.mjs loop-designing
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-clean-install.mjs loop-designing
git diff --check
```

Expected: syntax check exits zero; harness reports `Loop Designing harness test passed.`; release regression, validator, and clean-install verifier pass; diff check emits no output.

- [ ] **Step 5: Commit and push the documentation**

Run:

```bash
git add README.md docs/superpowers/plans/2026-08-12-readme-onboarding.md
git commit -m "docs: simplify public setup"
git push origin release/v0.1.0-hardening
```

Expected: the branch advances on `origin/release/v0.1.0-hardening`.

- [ ] **Step 6: Update and verify GitHub About metadata**

Run:

```bash
gh repo edit Katikita/loopdesigning --description "Train an AI design collaborator over time with three visual concepts, human critique, fidelity QA, evaluation, and approved memory for Codex."
gh repo view Katikita/loopdesigning --json description,url
```

Expected: the JSON description exactly matches the approved description and the URL is `https://github.com/Katikita/loopdesigning`.
