# Public Beta Release Design

## Goal

Prepare Loop Designing for a trustworthy `v0.1.0` GitHub beta that people can install and use in Codex without changing the core state-machine model.

## Release contract

The beta remains a standalone skill. The `loop-designing/` directory is the installable artifact; the repository root contains public documentation, release metadata, CI, and QA tooling. Plugin packaging is a later distribution milestone.

The release must provide:

1. Project-background onboarding that helps concept generation understand the product without adding a new start gate.
2. Recovery from malformed or obsolete configuration through `init --force`.
3. CI on Node 18, 22, and 24.
4. A permissive public license and explicit beta version.
5. One genuine end-to-end QA run that reaches both human gates and uses three bitmap concepts.
6. Reproducible clean-install verification from the repository layout.

## Project-background onboarding

`init` creates `project-context.md` when it does not exist and adds it to the default `contextFiles`. The template asks for product purpose, users, constraints, current experience, technical context, and success criteria. It is recommended context, not a prerequisite: if deleted or left incomplete, the existing snapshot behavior records what is available and `start` still depends only on a requirement plus at least one design-context source.

`init --force` replaces the configuration without parsing or validating the existing configuration. It never overwrites an existing `project-context.md`, because that file may contain user-authored product knowledge.

## Public release surface

- `VERSION` contains `0.1.0`.
- `LICENSE` uses the MIT text, subject to the repository owner's confirmation.
- `.github/workflows/ci.yml` runs syntax checks, the harness, skill validation, and clean-install verification on Node 18, 22, and 24.
- `scripts/validate-skill.mjs` checks the dependency-free structural contract required by this repository.
- `scripts/verify-clean-install.mjs` copies only the installable skill into a temporary consumer home/workspace, initializes it, starts a run with one reference, and verifies the persisted project-context snapshot.
- The README explains beta status, installation, privacy/safety boundaries, clean validation, and the later plugin path.

## End-to-end QA

Use a disposable host project. Initialize the skill, fill project background, supply a requirement and reference, generate exactly three bitmap concepts with separate hypotheses and preserved prompts, pause for human selection, implement the selected concept in the disposable project, evaluate it, pause for the human verdict, and record the final memory action. Preserve the run directory as QA evidence outside the installable skill.

The agent running QA may not select a concept or pass its own work. Completion therefore requires the repository owner to answer both gates.

## Boundaries

- Do not push, tag, create a GitHub release, or submit a plugin without separate authorization.
- Do not add a hosted service, telemetry, package manager dependency, or Chronicle integration.
- Do not make `project-context.md` mandatory.
- Do not fetch URL design references.
- Do not weaken any existing human, command-approval, provenance, or memory gate.
