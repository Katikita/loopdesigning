# Visual-Fidelity QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Loop Designing diagnose bitmap-dependent implementation gaps, obtain an explicit asset decision, and compare rendered output with the selected concept before implementation registration.

**Architecture:** Keep the CLI state machine unchanged. Rename the generated onboarding heading deterministically in `loop.mjs`, place the detailed visual-fidelity procedure in one focused reference contract, and keep only stage-routing instructions in `SKILL.md`. Require that reference in release validation so a clean public install cannot omit the gate.

**Tech Stack:** Dependency-free Node.js ESM CLI, Markdown Codex skill instructions, Node `assert` integration harness, release validator and clean-install verifier.

## Global Constraints

- Existing user-authored `project-context.md` files remain valid and are not rewritten by force initialization.
- Implementation-time ImageGen requires an explicit human choice.
- Structural UI, text, controls, state, responsive behavior, and accessibility remain code-native when ImageGen fills a visual gap.
- Compare rendered evidence with the selected concept before showing the preview or running `implemented`.
- Do not register an implementation with an unexplained high-impact mismatch.
- Perform at most two internal render-and-correct passes before returning to the human.
- Do not add a CLI state or change the run-state schema.
- Preserve Node.js 18 compatibility and add no runtime dependencies.

---

### Task 1: Rename the generated onboarding prompt

**Files:**
- Modify: `loop-designing/scripts/test-harness.mjs:61`
- Modify: `loop-designing/scripts/loop.mjs:741`

**Interfaces:**
- Consumes: existing `init` command and `writeTextIfMissing` preservation behavior.
- Produces: new workspaces contain the exact heading `## Current design experience`; existing context files remain byte-for-byte unchanged.

- [ ] **Step 1: Change the scaffold assertion first**

```js
assert.equal(
  fs.readFileSync(path.join(onboardingWorkspace, "project-context.md"), "utf8"),
  "# Project context\n\n## Product purpose\n\n## Primary users\n\n## Current design experience\n\n## Product and technical constraints\n\n## Success criteria\n"
);
```

- [ ] **Step 2: Run the harness and verify RED**

Run:

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node loop-designing/scripts/test-harness.mjs
```

Expected: FAIL because the generated scaffold still contains `## Current experience`.

- [ ] **Step 3: Update only the generated scaffold string**

Replace the init template with:

```js
"# Project context\n\n## Product purpose\n\n## Primary users\n\n## Current design experience\n\n## Product and technical constraints\n\n## Success criteria\n"
```

- [ ] **Step 4: Run the full harness and verify GREEN**

Run the command from Step 2.

Expected: `Loop Designing harness test passed.` The existing assertions that force initialization preserves `Keep this product knowledge.\n` and `Keep concurrent knowledge.\n` must also pass.

- [ ] **Step 5: Commit the scaffold change**

```bash
git add loop-designing/scripts/loop.mjs loop-designing/scripts/test-harness.mjs
git commit -m "fix: clarify current design experience onboarding"
```

---

### Task 2: Add the visual-medium and fidelity contracts

**Files:**
- Create: `loop-designing/references/visual-fidelity-contract.md`
- Modify: `loop-designing/SKILL.md:17,34-37,55-65,85-91`
- Modify: `README.md:51-55,152,204`

**Interfaces:**
- Consumes: selected concept, verbatim critique, target framework, authorized assets, and rendered implementation evidence.
- Produces: a required pre-implementation assessment, explicit human asset decision, bounded comparison loop, and implementation-summary evidence.

- [ ] **Step 1: Establish the baseline skill failures with fresh agents**

Copy the current installable skill to a temporary directory before editing it. Run fresh-context agents against these raw scenarios without mentioning the desired fix:

```text
Use the Loop Designing skill at <baseline-skill-path>. The user selected a mobile concept whose hero is a dimensional ceramic garden with realistic material, lighting, and pixel flowers. Implement the selected concept in SwiftUI. Describe exactly what you do before writing code and when you show the first preview.
```

```text
Use the Loop Designing skill at <baseline-skill-path>. The user selected a native settings screen made only of standard navigation, text, toggles, and grouped lists. Implement it in SwiftUI. Describe any asset questions you ask before coding.
```

```text
Use the Loop Designing skill at <baseline-skill-path>. Your first render compiles, but its main illustration, hierarchy, and spacing differ substantially from the selected bitmap concept. Describe the next action and whether you register implementation.
```

Record whether the baseline: redraws rich art in code without disclosure, asks an unnecessary asset question for code-native UI, or registers a visually mismatched preview.

- [ ] **Step 2: Write the focused reference contract**

Create `visual-fidelity-contract.md` with these required sections and exact classifications:

```markdown
# Visual-fidelity contract

## Assess the visual medium

Classify each visually important element as `code-native`, `existing-asset`, or `asset-dependent`.

For every material `asset-dependent` element, name the limitation and ask the human to choose ImageGen, an existing/provided asset, or a named simplified code-native approximation. Do not use ImageGen for an implementation asset before that choice.

## Compare before registration

Render at the selected concept's viewport when visual output is supported. Compare composition and hierarchy; spacing, scale, alignment, and placement; typography and color relationships; imagery, depth, material, texture, and lighting; responsive behavior and platform conventions; and every recorded critique item.

Classify material mismatches as `code-fixable`, `asset-dependent`, `intentional-deviation`, or `environment-blocked`.

Correct `code-fixable` mismatches before presenting the preview. Return `asset-dependent` mismatches to the human asset decision. Explain intentional and environment-blocked deviations. Do not run `implemented` with an unexplained high-impact mismatch.

Perform at most two internal render-and-correct passes. If a high-impact mismatch remains, show the selected concept, latest render, classification, and decision needed to the human.

## Record evidence

The implementation summary records the assessment, asset decisions, comparison viewport, correction-pass count, fidelity result, and remaining disclosed deviations.
```

- [ ] **Step 3: Route the main skill through the contract**

In initialization guidance, use `current design experience` and define it as the interface, visual language, interaction patterns, and existing user journey.

Add the reference router:

```markdown
- [references/visual-fidelity-contract.md](references/visual-fidelity-contract.md) after concept selection and throughout implementation QA.
```

At the start of implementation, require the assessment and asset decision before code. Before preview presentation or `implemented`, require the side-by-side comparison and evidence fields from the contract.

Add these non-negotiable gates:

```markdown
- Do not silently replace an asset-dependent visual with a code approximation.
- Do not use ImageGen for implementation assets without the human's explicit asset choice.
- Do not register an implementation with an unexplained high-impact concept-fidelity mismatch.
```

- [ ] **Step 4: Update public README copy**

Describe `current design experience`, the visual-medium assessment, explicit ImageGen choice, selected-concept comparison, two-pass correction bound, and disclosure of unresolved mismatches. Keep the README focused on public behavior; detailed classifications remain in the reference contract.

- [ ] **Step 5: Forward-test the edited skill**

Run fresh-context agents against the three Step 1 scenarios plus:

```text
Use the Loop Designing skill at <edited-skill-path>. Two render-and-correct passes still leave the main illustration visibly unlike the selected concept. Describe exactly what you show the user and whether you continue correcting silently.
```

Pass criteria:

- rich dimensional artwork triggers a specific limitation and explicit three-route asset choice before implementation;
- standard native settings UI proceeds code-native without an ImageGen question;
- a high-impact mismatch blocks `implemented` and is classified;
- after two failed correction passes, the agent returns the comparison and decision to the human instead of silently iterating again.

If any scenario fails, tighten only the ambiguous instruction and repeat that scenario with a fresh agent.

- [ ] **Step 6: Validate instructions and commit**

Run:

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/validate-skill.mjs loop-designing
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-clean-install.mjs loop-designing
git diff --check
```

Expected: validator success, clean-install success, and no diff errors.

Commit:

```bash
git add README.md loop-designing/SKILL.md loop-designing/references/visual-fidelity-contract.md
git commit -m "feat: gate implementation on visual fidelity"
```

---

### Task 3: Require the fidelity contract in public release validation

**Files:**
- Modify: `scripts/test-release.mjs`
- Modify: `scripts/validate-skill.mjs`

**Interfaces:**
- Consumes: an installable `loop-designing/` directory.
- Produces: validation failure when `references/visual-fidelity-contract.md` is missing or not a regular file.

- [ ] **Step 1: Add the missing-reference release regression first**

```js
rejects("missing-visual-fidelity-contract", (skill) => {
  fs.rmSync(path.join(skill, "references", "visual-fidelity-contract.md"));
});
```

- [ ] **Step 2: Run release tests and verify RED**

Run:

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/test-release.mjs
```

Expected: FAIL because the validator and verifier still accept the copied skill without the new reference.

- [ ] **Step 3: Require the reference as a regular file**

Add:

```js
const requiredReferences = ["references/visual-fidelity-contract.md"];
```

Then validate it beside required scripts:

```js
for (const reference of requiredReferences) {
  requireRegularFile(path.join(skillDirectory, reference), `required reference ${reference}`);
}
```

- [ ] **Step 4: Run release tests and verify GREEN**

Run the command from Step 2.

Expected: `Loop Designing release regression test passed.`

- [ ] **Step 5: Commit release validation**

```bash
git add scripts/test-release.mjs scripts/validate-skill.mjs
git commit -m "test: require visual fidelity contract in releases"
```

---

### Task 4: Run the complete public-release verification and push

**Files:**
- Verify all changed files from Tasks 1-3.

**Interfaces:**
- Consumes: the completed branch.
- Produces: a public branch that tomorrow's testers can install from GitHub.

- [ ] **Step 1: Run syntax checks**

```bash
for file in loop-designing/scripts/loop.mjs loop-designing/scripts/test-harness.mjs scripts/validate-skill.mjs scripts/verify-clean-install.mjs scripts/test-release.mjs; do
  /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --check "$file"
done
```

Expected: all exit 0.

- [ ] **Step 2: Run all behavioral and release checks**

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node loop-designing/scripts/test-harness.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/test-release.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/validate-skill.mjs loop-designing
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-clean-install.mjs loop-designing
git diff --check
git status --short
```

Expected: harness, release regression, validator, and clean-install verifier pass; diff check is empty; status contains no uncommitted changes.

- [ ] **Step 3: Review the branch delta**

```bash
git log --oneline --decorate origin/release/v0.1.0-hardening..HEAD
git diff --stat origin/release/v0.1.0-hardening...HEAD
```

Confirm the delta contains the existing hardening commits plus the approved visual-fidelity spec and implementation, with no consumer E2E project files or generated images.

- [ ] **Step 4: Push the tested branch**

```bash
git push origin release/v0.1.0-hardening
```

Expected: GitHub updates `release/v0.1.0-hardening` to the verified local HEAD. Report that Node 18/22 remain CI-matrix verification because only bundled Node 24 was available locally.
