# Visual-fidelity contract

## Assess the visual medium

Classify each visually important element as `code-native`, `existing-asset`, or `asset-dependent`.

When all visually important elements are `code-native`, proceed without asking an asset question.

For every material `asset-dependent` element, name the limitation and ask the human to choose ImageGen, an existing/provided asset, or a named simplified code-native approximation. Do not use ImageGen for an implementation asset before that choice.

## Compare before registration

Render at the selected concept's viewport when visual output is supported. Compare composition and hierarchy; spacing, scale, alignment, and placement; typography and color relationships; imagery, depth, material, texture, and lighting; responsive behavior and platform conventions; and every recorded critique item.

Classify material mismatches as `code-fixable`, `asset-dependent`, `intentional-deviation`, or `environment-blocked`.

Correct `code-fixable` mismatches before presenting the preview. Return `asset-dependent` mismatches to the human asset decision. Explain intentional and environment-blocked deviations. Do not run `implemented` with an unexplained high-impact mismatch.

Perform at most two internal render-and-correct passes. If a high-impact mismatch remains, show the selected concept, latest render, classification, and decision needed to the human.

## Record evidence

The implementation summary records the assessment, asset decisions, comparison viewport, correction-pass count, fidelity result, and remaining disclosed deviations.
