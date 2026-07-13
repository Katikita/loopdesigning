# Memory contract

The run archive remembers everything as evidence. Canonical memory contains only explicit, reusable human-approved lessons.

## Memory levels

| Level | Contents | Authority |
|---|---|---|
| Run history | Requirements, concepts, critiques, implementation evidence, evaluations, verdicts | Evidence only |
| Rejected memory | Patterns the human rejected, with reason and scope | Negative guidance |
| Approved memory | Reusable preferences, principles, and implementation rules | Evaluation input |
| Product canon | Host-project principles and accepted decisions | Highest; managed outside this skill |

Do not promote raw conversation, inferred preferences, or evaluator opinions automatically.

## Memory proposal schema

Register and show this proposal to the human before recording a passing verdict:

```json
{
  "entries": [
    {
      "polarity": "prefer",
      "kind": "preference",
      "statement": "Use one dominant focal action on account overview screens.",
      "rationale": "The approved concept reduced scanning pressure on this surface.",
      "scope": "project",
      "tags": ["account", "hierarchy"],
      "evidence": "Human verdict for the approved implementation."
    },
    {
      "polarity": "avoid",
      "kind": "anti-pattern",
      "statement": "Avoid equal-weight metric panels when one decision should dominate.",
      "rationale": "The human rejected the direction because it obscured the primary decision.",
      "scope": "tag",
      "tags": ["hierarchy", "decision-making"],
      "evidence": "Concept B critique."
    }
  ]
}
```

Allowed `polarity`: `prefer`, `avoid`.

Allowed `scope`:

- `global`: transferable across projects; use rarely and only when the human says so.
- `project`: applies to the configured project.
- `tag`: applies only when a future run shares at least one tag.

Every entry requires a statement, rationale, scope, tags array, and evidence. The harness adds ID, project, source run, and approval timestamp only after the human uses `--memory-action approve`. `skip` completes the run without canonical promotion; the proposal remains in run history.

Every evaluation must register a proposal. Use `{ "entries": [] }` to state explicitly that no reusable learning is proposed. The harness rejects normalized duplicates and stores a hash; a modified proposal cannot be approved without recording the evaluation again.

## Retrieval

At run start, include:

- all active global memory;
- active project memory with an exact `project` match to the configured project; legacy project entries without a project binding are ignored until explicitly migrated;
- active tag memory sharing a run tag.

Keep approved and rejected memory separate. Product canon always outranks learned memory.
