# README onboarding design

## Goal

Help a new Codex user understand the product promise, install Loop Designing, and begin a valid first run without first learning the CLI or repository internals.

## Product promise

Lead with an ambitious but bounded message: Loop Designing helps train an AI design collaborator that becomes more aligned over time. Immediately explain the mechanism—persistent critique, verdicts, and scoped memory that is promoted only with human approval—so the README does not imply model retraining or guaranteed improvement.

## Information order

1. A two-sentence hook and public-beta status.
2. A concise explanation of the governed design loop.
3. Requirements and copy-paste installation, with global installation first.
4. A first-run prompt that works with one concrete local reference.
5. Optional onboarding for `design.md`, project context, design-system sources, reference screens, and design rules.
6. The stages users will experience and the decisions expected from them.
7. Memory and authority: requirements and product canon outrank learned memory.
8. Configuration and raw CLI usage for advanced users.
9. Contributor validation, repository structure, safety, and current boundaries.

## Setup contract

- State Node.js 18+, Codex skill support, and bitmap image generation as requirements.
- Provide global and repository-local installation commands.
- Tell users to reopen Codex or start a new task after installation so the skill can be discovered.
- Use `$loop-designing` as the primary interface; describe direct CLI usage as advanced.
- Require at least one local workspace file or HTTP(S) reference for a new run.
- Explain that richer context is recommended, not mandatory.
- Show `design.md` in `contextFiles` as authoritative product canon; keep managed JSONL memory separate.

## GitHub repository description

Use a short product-focused description rather than setup instructions:

> Train an AI design collaborator over time with three visual concepts, human critique, fidelity QA, evaluation, and approved memory for Codex.

## Verification

- Check every documented path and command against the CLI and configuration contract.
- Run Markdown/link-oriented text checks for required setup sections and stale claims.
- Run the release validator, clean-install verifier, and existing harness.
- Review the final diff for readability and preservation of public-beta limitations.
