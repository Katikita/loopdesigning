# Public Beta Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Loop Designing for a test-backed `v0.1.0` standalone-skill beta that can be installed from GitHub and exercised through a real human-gated run.

**Architecture:** Keep the dependency-free Node ESM state machine as the source of behavior. Extend initialization with a non-destructive product-context scaffold, add repository-level validators and CI, then verify the exact installable directory from a temporary consumer environment before running a real design loop.

**Tech Stack:** Node.js 18+ ESM and standard library, GitHub Actions, Markdown skill instructions, YAML agent metadata.

## Global Constraints

- Keep the only `start` prerequisites as a requirement and at least one concrete design-context source.
- Treat `project-context.md` as recommended and never overwrite an existing copy.
- `init --force` must replace malformed and unsupported configuration without reading it.
- Keep the installable `loop-designing/` directory free of root release documentation.
- Use no runtime dependencies outside the Node.js standard library.
- Test Node 18, 22, and 24 in CI.
- Do not push, tag, publish, or submit a plugin without separate user authorization.
- Preserve every existing human, command-approval, provenance, and memory gate.

---

### Task 1: Project Background and Force Recovery

**Files:**
- Modify: `loop-designing/scripts/test-harness.mjs`
- Modify: `loop-designing/scripts/loop.mjs`
- Modify: `loop-designing/SKILL.md`
- Modify: `loop-designing/references/configuration.md`
- Modify: `README.md`

**Interfaces:**
- `init [--force]` produces `loop-designing.config.json` and, only when absent, `project-context.md`.
- The default config contains `contextFiles: ["project-context.md"]`.

- [ ] **Step 1: Add failing behavior tests**

  Extend the harness to assert that initial `init` creates a project-context template and config reference, a second plain `init` fails, and both malformed JSON and `schemaVersion: 999` are recoverable with `init --force`. Before force recovery, replace the template with `Keep this product knowledge.\n`; after recovery, assert those exact bytes remain.

- [ ] **Step 2: Run the harness and verify RED**

  Run: `node loop-designing/scripts/test-harness.mjs`

  Expected: FAIL because the template is absent and malformed configuration is parsed before `--force` is honored.

- [ ] **Step 3: Implement the minimum initialization behavior**

  Resolve the config path without reading it when `args.force` is true. Write this exact scaffold only when `project-context.md` does not exist:

  ```markdown
  # Project context

  ## Product purpose

  ## Primary users

  ## Current experience

  ## Product and technical constraints

  ## Success criteria
  ```

  Set `contextFiles` to `["project-context.md"]`, report both generated paths on first init, and report only the config on force when the project file already exists.

- [ ] **Step 4: Run the harness and verify GREEN**

  Run: `node loop-designing/scripts/test-harness.mjs`

  Expected: `Loop Designing harness test passed.`

- [ ] **Step 5: Pressure-test and document onboarding**

  Baseline a fresh agent against the pre-change skill, then forward-test the changed skill with a user who has one screenshot but no product background file. The desired behavior is to recommend gathering purpose, users, constraints, and success criteria without inventing them or blocking `start` when the user declines.

- [ ] **Step 6: Commit**

  ```bash
  git add README.md loop-designing/SKILL.md loop-designing/references/configuration.md loop-designing/scripts/loop.mjs loop-designing/scripts/test-harness.mjs
  git commit -m "feat: scaffold project context during onboarding"
  ```

### Task 2: Release Metadata and Repository QA

**Files:**
- Create: `LICENSE`
- Create: `VERSION`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/validate-skill.mjs`
- Create: `scripts/verify-clean-install.mjs`
- Modify: `README.md`

**Interfaces:**
- `node scripts/validate-skill.mjs loop-designing` exits zero only for a structurally valid installable folder.
- `node scripts/verify-clean-install.mjs loop-designing` runs a real init/start flow from a temporary copied installation.

- [ ] **Step 1: Write the validator and consumer verifier contracts**

  The validator checks folder/name agreement, `SKILL.md` frontmatter with non-empty `name` and `description`, a non-empty instruction body, optional `agents/openai.yaml` interface fields, and required script files. The consumer verifier copies only `loop-designing/`, creates a clean host workspace, initializes it, fills `project-context.md`, starts with one local reference, then checks the state, design-context manifest, and context snapshot.

- [ ] **Step 2: Run both scripts against intentionally invalid fixtures**

  Use temporary copies with a missing `SKILL.md` and missing CLI script and verify each validator exits non-zero for the contract it protects.

- [ ] **Step 3: Implement release files**

  Add `VERSION` with `0.1.0`, the standard MIT license text, and a GitHub Actions matrix for `18.x`, `22.x`, and `24.x`. Each matrix job runs both syntax checks, the harness, the skill validator, and the clean-install verifier.

- [ ] **Step 4: Update public documentation**

  Document beta version, minimum runtime, install paths, clean verification, local-file snapshots, non-fetched URL references, command approval, external-publication authorization, and the future plugin distribution path.

- [ ] **Step 5: Verify and commit**

  ```bash
  node scripts/validate-skill.mjs loop-designing
  node scripts/verify-clean-install.mjs loop-designing
  git diff --check
  git add .github/workflows/ci.yml LICENSE VERSION README.md scripts
  git commit -m "chore: prepare v0.1.0 public beta"
  ```

### Task 3: Real Human-Gated End-to-End QA

**Files:**
- Create outside repository: `work/loopdesigning-v0.1-e2e/`

**Interfaces:**
- The disposable host project consumes the copied skill exactly as a user installation would.
- The run advances through every persisted state and stops for both human decisions.

- [ ] **Step 1: Build the disposable host fixture**

  Initialize a simple static account-overview project, fill project background, add one visual reference and requirement, then run `init` and `start` from the consumer workspace.

- [ ] **Step 2: Generate and register concepts**

  Generate exactly three bitmap concepts from the same saved inputs. Give each a distinct layout hypothesis and preserve the exact prompt in the concepts manifest. Register them and present all three to the repository owner.

- [ ] **Step 3: Stop for concept selection**

  Record the owner's critique verbatim and either register the selected ID or generate another set. Do not self-select.

- [ ] **Step 4: Implement and evaluate**

  Implement only the selected direction in the disposable static project, capture bitmap evidence, register an empty external-target manifest, build the evaluation packet, and record a report plus explicit memory proposal.

- [ ] **Step 5: Stop for final verdict**

  Present the evidence and proposal. Record the owner's `pass`, iteration route, or archive decision exactly. Do not self-approve.

### Task 4: Final Verification and Release Handoff

**Files:**
- Review: all changes since `15da1a6`

**Interfaces:**
- Produces a reviewed release branch ready for an explicit push/tag decision.

- [ ] **Step 1: Run the complete verification suite**

  ```bash
  node --check loop-designing/scripts/loop.mjs
  node --check loop-designing/scripts/test-harness.mjs
  node loop-designing/scripts/test-harness.mjs
  node scripts/validate-skill.mjs loop-designing
  node scripts/verify-clean-install.mjs loop-designing
  git diff --check 15da1a6...HEAD
  ```

- [ ] **Step 2: Review requirements line by line**

  Confirm project context is optional, force recovery is regression-tested, CI includes all three versions, license/version exist, the real run reached both human gates, and clean installation used only the copied skill folder.

- [ ] **Step 3: Request independent whole-branch review**

  Review correctness, Node 18 compatibility hazards, security boundaries, documentation truthfulness, installability, and release readiness. Fix every verified Critical or Important finding with a new failing test when behavior changes.

- [ ] **Step 4: Hand off without publishing**

  Report commits, fresh verification output, E2E evidence, and remaining limitations. Ask separately for authorization before pushing `main`, creating tag `v0.1.0`, or creating a GitHub release.
