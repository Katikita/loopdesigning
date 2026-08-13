# Visual-Fidelity QA Design

## Goal

Prevent Loop Designing from translating every selected bitmap concept directly into code and discovering major visual mismatches only after the human reviews the implementation.

The skill must identify when code cannot faithfully reproduce a concept, obtain an explicit asset decision, and compare the rendered implementation with the selected concept before registering the implementation.

## Onboarding language

Rename the project-context prompt `Current experience` to `Current design experience` everywhere it appears in generated scaffolds and public guidance.

The prompt means the interface, visual language, interaction patterns, and existing user journey—not general product history or business performance.

Existing user-authored `project-context.md` files remain valid. Initialization never rewrites an existing `project-context.md`; `init --force` replaces the configuration only and never overwrites the context file.

## Pre-implementation visual-medium assessment

After concept selection and before implementation, classify each visually important part of the selected concept as one of:

- `code-native`: layout, typography, controls, responsive behavior, and simple vector or system shapes that the target framework can reproduce faithfully;
- `existing-asset`: a supplied or already-authorized project asset;
- `asset-dependent`: photography, dimensional illustration, rich texture, material, lighting, or other bitmap detail that code cannot faithfully reproduce.

Do not redraw the entire concept automatically in code when an `asset-dependent` element materially affects fidelity.

For every material `asset-dependent` element, name the specific limitation and ask the human to choose:

1. generate a project-bound asset with ImageGen;
2. provide or select an existing asset;
3. accept a named simplified code-native approximation.

Do not invoke ImageGen for implementation assets until the human chooses that route. Concept generation remains bitmap-based and follows its existing contract.

Record the assessment and the human's asset decision in the implementation summary. If the human chooses ImageGen, keep structural UI, text, controls, state, responsive behavior, and accessibility code-native; use the generated bitmap only for the diagnosed visual gap.

## Pre-registration visual-fidelity QA gate

Render the implementation at the selected concept's viewport when the target supports visual output. Compare the rendered evidence side-by-side with the selected concept before showing the implementation preview to the human or running `implemented`.

Inspect:

- overall composition and information hierarchy;
- relative spacing, scale, alignment, and placement;
- typography and color relationships;
- imagery, dimensional depth, material, texture, and lighting;
- responsive behavior and target-platform conventions;
- every item in the human's recorded critique.

Classify every material mismatch as:

- `code-fixable`: correct it before presenting the preview;
- `asset-dependent`: return to the asset decision and pause for human input;
- `intentional-deviation`: state the target constraint and why the deviation is preferable;
- `environment-blocked`: state what could not be rendered or inspected and why.

Do not register an implementation while a high-impact mismatch is unexplained. Passing compilation or deterministic checks does not satisfy this visual gate.

## Bounded correction

Perform at most two internal render-and-correct passes before returning to the human. This limit prevents silent, indefinite approximation loops.

If a high-impact mismatch remains after two passes, present:

- the selected concept;
- the latest rendered evidence;
- the mismatch classification;
- the specific limitation or decision needed.

The human can then approve the disclosed deviation, choose an asset route, revise the implementation direction, or return to concepts.

## Evidence and persistence

The implementation summary must contain:

- the visual-medium assessment;
- the human's asset decision for every material asset-dependent element;
- the viewport used for comparison;
- the number of internal correction passes;
- the visual-fidelity result;
- remaining intentional or environment-blocked deviations.

The existing `implemented` command and run states remain unchanged. This is a required skill-level gate, not a new CLI transition. The implementation preview remains human-reviewed before registration, and post-registration rejection continues to use `revise-implementation`.

## Public documentation

README workflow documentation must tell users that:

- “current design experience” is recommended onboarding context;
- the skill diagnoses bitmap-dependent fidelity gaps before coding;
- implementation-time ImageGen requires an explicit choice;
- selected-concept comparison occurs before implementation registration;
- unresolved high-impact mismatches are disclosed rather than hidden behind repeated iteration.

## Verification

Automated tests cover the renamed generated scaffold and preserve the existing force-initialization behavior.

Skill pressure scenarios cover:

1. a visually rich selected concept where an agent would otherwise redraw dimensional artwork in code;
2. a code-native concept that should not trigger an unnecessary ImageGen question;
3. a rendered implementation with a high-impact mismatch that must not be registered;
4. a mismatch still present after two correction passes that must be returned to the human.

Release validation and clean-install verification continue to run unchanged after the new behavior is documented.
