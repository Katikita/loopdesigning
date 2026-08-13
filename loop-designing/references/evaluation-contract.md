# Evaluation contract

Evaluation combines deterministic checks with model-assisted design judgment. Neither layer can issue the final human verdict.

## Evaluation packet

The `evaluate` command creates a packet containing:

- original requirement and references;
- snapshotted project principles;
- retrieved approved and rejected memory;
- selected concept and hypothesis;
- verbatim human critique;
- delivery-target authorization/status records;
- implementation summary, evidence paths and hashes, tracked diff, and archived untracked-file provenance;
- configured technical check results.

Read the packet before inspecting the UI. Inspect visual evidence or the running interface when UI changed.

Prepare the structured memory proposal before requesting the final human verdict. Register an explicit empty proposal when there is no reusable learning. The human must see the exact stored proposal alongside the evaluation and explicitly approve or skip it; its hash is verified again at approval time.

Configured checks are repository-controlled programs. An evaluation call with no matching approval returns their exact commands, environment allowlist, timeout, and fingerprint without running them. Show these to the human and proceed only after explicit approval of that fingerprint. The same approval may be reused within the run while the fingerprint is unchanged; a changed command, timeout, or environment allowlist requires new approval.

When a failure belongs to the check configuration, check environment, or evaluation report rather than the implementation, record `retry-evaluation`. The harness preserves the selected concept and implementation, retains the earlier evidence, and writes the next attempt to a distinct evaluation directory. Do not mislabel this route as implementation iteration.

## Report schema

```json
{
  "recommendation": "pass",
  "summary": "The implementation follows the selected hierarchy and passes technical checks.",
  "findings": [
    {
      "ruleId": "emotional-safety",
      "source": "design/EVAL_RUBRIC.md",
      "status": "pass",
      "severity": "high",
      "evidence": "The changed interface contains one primary action and no judgmental progress language."
    }
  ]
}
```

Allowed recommendation: `pass`, `fail`.

Allowed finding status: `pass`, `fail`, `not-applicable`.

Allowed severity: `low`, `medium`, `high`.

Every finding must cite its rule source and concrete evidence. Do not use vague claims such as “looks polished.”

## Evaluation order

1. Check requirement coverage.
2. Check selected-concept fidelity and incorporated critique.
3. Check product canon and design principles.
4. Check retrieved approved and rejected memory.
5. Check responsive behavior, accessibility, interaction states, and technical output.
6. Name conflicts and unresolved risks.

If a learned rule conflicts with product canon, mark the learned rule inapplicable and flag the conflict for the human.
