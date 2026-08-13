# Design Context Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new Loop Designing run start from at least one concrete, categorized design-context source while preserving legacy `--ref` calls.

**Architecture:** Extend the existing dependency-free Node.js CLI with a small parser/validator that normalizes legacy references and structured `kind=source` inputs before any run directory is created. Persist the normalized inventory beside the existing reference manifest, surface it in the context snapshot and state, then teach the skill to gather the inputs conversationally.

**Tech Stack:** Node.js 18+ ESM, Node standard library, Markdown skill instructions and references, YAML agent metadata.

## Global Constraints

- Require at least one concrete source from any onboarding category.
- Treat all checklist items and groups as optional beyond that one-source minimum.
- Keep repeatable `--ref` backward compatible and categorize it as `reference-screen`.
- Accept only `tokens`, `typography`, `layout`, `components`, `reference-screen`, `approved-decisions`, `rejected-patterns`, and `accessibility` structured kinds.
- Keep local sources inside the host workspace and reuse the existing safe artifact-copy behavior.
- Do not fetch URL contents.
- Leave no run artifacts after input validation fails.
- Preserve all existing state-machine gates and config schema version `1`.

---

### Task 1: Normalize and Persist Design Context

**Files:**
- Modify: `loop-designing/scripts/test-harness.mjs`
- Modify: `loop-designing/scripts/loop.mjs`

**Interfaces:**
- Consumes: repeatable `args.ref` and `args["design-context"]` values from `parseArgs()`.
- Produces: normalized entries shaped as `{ kind, group, type, value?, source?, stored?, sha256? }`, plus `{ sourceCount, suppliedKinds, missingGroups, sparseWarning }`.

- [ ] **Step 1: Write failing zero-input and legacy compatibility tests**

  In the integration harness, create a separate initialized workspace for onboarding failures. Assert that `start --id LD-no-context --requirement-file <file>` exits `1`, contains `Provide at least one --ref or --design-context source`, and does not create `runs/LD-no-context`. Update the existing successful `LD-test-1` start to pass `--ref <local reference-screen fixture>`, then assert its summary has one source, `reference-screen`, the optional `design-system` and `design-rules` gaps, and a non-empty sparse warning.

- [ ] **Step 2: Run the harness and verify RED**

  Run: `node loop-designing/scripts/test-harness.mjs`

  Expected: FAIL because a zero-context start currently succeeds or the expected design-context summary is absent.

- [ ] **Step 3: Add normalization and preflight validation**

  In `loop.mjs`, define the supported kind-to-group mapping:

  ```js
  const DESIGN_CONTEXT_GROUPS = {
    tokens: "design-system",
    typography: "design-system",
    layout: "design-system",
    components: "design-system",
    "reference-screen": "reference-screens",
    "approved-decisions": "design-rules",
    "rejected-patterns": "design-rules",
    accessibility: "design-rules",
  };
  ```

  Add a pure `parseDesignContextArgs(args)` helper that converts `--ref` values to `reference-screen`, parses structured values on the first `=`, rejects missing/unknown kinds and empty sources, rejects duplicate normalized kind/source pairs, and returns entries plus summary. Call it in `commandStart` before `ensureDir(resolved.runsDir)`, active-run lookup, or any other mutation.

- [ ] **Step 4: Persist normalized local and URL sources**

  Add a preparation helper that records HTTP(S) sources as URLs and copies local files through `copyArtifact` into `references/`. Write both the backward-compatible `{ references }` manifest and a new `references/design-context.json` manifest. Include the manifest path, entries, and summary in run state and include `designContextSummary` in successful `start` output.

- [ ] **Step 5: Include categorized inventory in the snapshot**

  Change `snapshotContext` to accept normalized entries and render a `## Design context` section grouped by design system, reference screens, and design rules before configured context files and retrieved memory. Include the normalized inventory and summary in `context/manifest.json`.

- [ ] **Step 6: Run the harness and verify GREEN**

  Run: `node loop-designing/scripts/test-harness.mjs`

  Expected: `Loop Designing harness test passed.`

- [ ] **Step 7: Add edge-case tests one at a time**

  Add assertions for every supported kind, multiple inputs, malformed `kind=source`, unknown kind, empty source, duplicate kind/source, missing local file, `../` escape, and symlink escape. For each new assertion, first run the harness to observe the intended failure, then make the smallest production adjustment necessary and rerun until green. Verify every invalid call leaves its target run path absent.

- [ ] **Step 8: Commit the runtime behavior**

  ```bash
  git add loop-designing/scripts/loop.mjs loop-designing/scripts/test-harness.mjs
  git commit -m "feat: require design context for new runs"
  ```

---

### Task 2: Teach the Skill the Optional Onboarding Checklist

**Files:**
- Modify: `loop-designing/SKILL.md`
- Modify: `loop-designing/references/configuration.md`
- Modify: `README.md`
- Review: `loop-designing/agents/openai.yaml`

**Interfaces:**
- Consumes: the CLI contract from Task 1.
- Produces: concise agent instructions that inventory optional inputs, require one source, warn about sparse context, and invoke the exact CLI syntax.

- [ ] **Step 1: Run a baseline fresh-context skill scenario without the new guidance**

  Give a fresh subagent the current skill plus this user request: `Start Loop Designing for a settings screen. I have no design system files, but please skip setup because I am in a hurry.` Record whether it starts without a source, treats every checklist item as mandatory, invents context, or correctly pauses. This is the RED artifact for the instruction change.

- [ ] **Step 2: Add the minimal onboarding recipe to SKILL.md**

  Before the current new-run command, instruct Codex to inventory the three groups, present supplied items and optional gaps, require one concrete file or URL, warn when only one source exists, and pass structured values with `--design-context kind=source`. Keep the body imperative and concise; do not turn the example names into required filenames or screens.

- [ ] **Step 3: Document the exact CLI contract**

  In `references/configuration.md`, add the supported kind table, group mapping, repeatability, `--ref` compatibility, local containment behavior, URL behavior, duplicate handling, summary fields, and minimal/rich command examples. Update the README start example to include one `--ref` and add a compact richer onboarding example.

- [ ] **Step 4: Check metadata consistency**

  Compare `agents/openai.yaml` with the updated skill. Keep it unchanged if its prompt remains accurate; otherwise regenerate only `display_name`, `short_description`, and `default_prompt` with the skill-creator helper and document why the generated change is needed.

- [ ] **Step 5: Forward-test the updated skill**

  Run fresh-context scenarios for: one screenshot only, one token file only, rich inputs across all groups, no inputs under time pressure, and a user mistakenly believing dashboard/detail/form are all required. Pass the skill artifact and user request without leaking expected answers. Confirm the agent asks for one source when empty, proceeds with one source, labels gaps optional, and uses valid CLI syntax.

- [ ] **Step 6: Commit the public guidance**

  ```bash
  git add README.md loop-designing/SKILL.md loop-designing/references/configuration.md loop-designing/agents/openai.yaml
  git commit -m "docs: add design context onboarding"
  ```

---

### Task 3: Publication QA

**Files:**
- Review: all files changed since `8558490`

**Interfaces:**
- Consumes: committed runtime and guidance changes from Tasks 1–2.
- Produces: reproducible validation evidence and a clean contribution branch ready for the user's publishing decision.

- [ ] **Step 1: Load the verification workflow**

  Read and follow `superpowers:verification-before-completion` before making any completion claim.

- [ ] **Step 2: Run syntax and integration checks**

  ```bash
  node --check loop-designing/scripts/loop.mjs
  node --check loop-designing/scripts/test-harness.mjs
  node loop-designing/scripts/test-harness.mjs
  ```

  Expected: both syntax checks exit `0`; harness prints `Loop Designing harness test passed.`

- [ ] **Step 3: Validate the installable skill structure**

  Run the bundled skill validator against `loop-designing/`. Expected: valid YAML frontmatter, required fields, and folder naming. Also verify `SKILL.md` remains below 500 lines and contains no unfinished placeholders.

- [ ] **Step 4: Verify documented commands in temporary workspaces**

  Execute the README minimal and rich start forms against temporary initialized workspaces using disposable fixture files. Confirm manifests, state, snapshot headings, summaries, and no-context errors match the documentation.

- [ ] **Step 5: Review compatibility and diff quality**

  Run `git diff --check 8558490...HEAD`, inspect `git diff --stat 8558490...HEAD`, review every changed line, and confirm `git status --short` is empty. If Node 18 is unavailable, record that the minimum-version claim remains unverified rather than claiming coverage.

- [ ] **Step 6: Request an independent code review**

  Use `superpowers:requesting-code-review` to check spec compliance, behavior, security boundaries, test quality, and publication readiness. Resolve verified findings with new failing tests before changing runtime code.

- [ ] **Step 7: Hand off without publishing**

  Report branch, commits, test evidence, known limitations, and exact remaining publishing choices. Do not push, open a pull request, or publish until the user separately authorizes that external action.
