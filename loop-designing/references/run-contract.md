# Run contract

Loop Designing is a persisted state machine. The CLI owns transitions; conversation alone does not.

## States

| State | Required action | Next states |
|---|---|---|
| `awaiting-concepts` | Generate and register exactly three image concepts | `awaiting-critique` |
| `awaiting-critique` | Obtain a human selection or iteration request | `awaiting-implementation`, `awaiting-concepts` |
| `awaiting-implementation` | Implement the selected concept, original critique, and any pending implementation revision | `awaiting-evaluation` |
| `awaiting-evaluation` | Run configured checks and build the evaluation packet, or record pre-evaluation preview feedback | `awaiting-evaluation-report`, `awaiting-implementation` |
| `awaiting-evaluation-report` | Record the model-assisted design evaluation | `awaiting-verdict` |
| `awaiting-verdict` | Obtain a human verdict | `complete`, `archived`, `awaiting-evaluation`, `awaiting-implementation`, `awaiting-concepts` |

Never skip a state. Every transition is appended to `state.json`.

On every resume, inspect the active state and read the artifacts it references before acting. When `state.implementationRevision` is non-null in `awaiting-implementation`, its verbatim contents are a mandatory additional critique, not optional context. The next `implemented` transition archives those notes as `incorporated-revision.md` in the new implementation attempt, records their path and digest in implementation provenance, exposes them to the evaluation packet, and only then clears the pending pointer. Any later pre-evaluation feedback rejecting that new attempt is stored independently as its `revision-request.md`. Evaluation must use the incorporated revision together with the original critique even though `state.implementationRevision` is null after registration.

## Concept manifest

Register exactly three local bitmap artifacts:

```json
{
  "concepts": [
    {
      "id": "A",
      "title": "Editorial calm",
      "hypothesis": "A strong editorial focal point reduces scanning pressure.",
      "prompt": "Create an editorially calm account overview using the supplied references...",
      "generator": "imagegen",
      "artifact": "/absolute/path/to/concept-a.png"
    }
  ]
}
```

Use unique short IDs. Each hypothesis must name a design proposition, not a color variation. Preserve the exact prompt; `generator` is optional provenance.

## Commands

Run all commands from the host workspace root:

```bash
node <skill-dir>/scripts/loop.mjs status [--run <id>]
node <skill-dir>/scripts/loop.mjs start --requirement-file <path> (--ref <path-or-url> | --design-context <kind=path-or-url>) [--ref <path-or-url>] [--design-context <kind=path-or-url>] [--tag <tag>] [--allow-dirty]
node <skill-dir>/scripts/loop.mjs concepts --run <id> --manifest <path>
node <skill-dir>/scripts/loop.mjs critique --run <id> --decision select --selection <id> --notes-file <path>
node <skill-dir>/scripts/loop.mjs critique --run <id> --decision iterate --notes-file <path>
node <skill-dir>/scripts/loop.mjs implemented --run <id> --summary-file <path> --targets-manifest <path> [--evidence <path>]
node <skill-dir>/scripts/loop.mjs revise-implementation --run <id> --notes-file <path>
node <skill-dir>/scripts/loop.mjs evaluate --run <id> [--checks-sha256 <approved-fingerprint>]
node <skill-dir>/scripts/loop.mjs record-evaluation --run <id> --report <path> --memory-proposal <path>
node <skill-dir>/scripts/loop.mjs verdict --run <id> --decision pass --notes-file <path> --memory-action <approve|skip>
node <skill-dir>/scripts/loop.mjs verdict --run <id> --decision retry-evaluation --notes-file <path>
node <skill-dir>/scripts/loop.mjs verdict --run <id> --decision iterate-implementation --notes-file <path>
node <skill-dir>/scripts/loop.mjs verdict --run <id> --decision iterate-concepts --notes-file <path>
node <skill-dir>/scripts/loop.mjs verdict --run <id> --decision archive --notes-file <path>
```

For `start`, provide at least one source; `--ref <path-or-url>` and `--design-context <kind=path-or-url>` are both repeatable. `--ref` is compatible shorthand for `--design-context reference-screen=<path-or-url>`.

## Failure routing

- Before evaluation, use `revise-implementation` when the human rejects the registered preview or visual evidence. Do not ask them to approve checks for a candidate they already know needs revision.
- After `revise-implementation`, read the `implementationRevision` artifact from state and apply it as mandatory additional critique. Do not register another implementation based only on the selected concept and original critique.
- Retry evaluation when the implementation is unchanged but a check path/configuration is invalid, the check environment failed transiently, or the evaluation report itself needs correction. This preserves the implementation, increments the evaluation attempt, and keeps prior evaluation evidence.
- Return to implementation when the selected concept is still correct but code, responsive behavior, states, accessibility, or visual fidelity are wrong.
- Return to concepts when the underlying composition, emotional direction, interaction model, or chosen hypothesis is wrong.
- Archive when the requirement is no longer valuable or the run should remain evidence without shipping.

## Artifact rule

Preserve every iteration. Never overwrite earlier concept, critique, implementation, evaluation, or verdict artifacts.

Pre-evaluation revision notes are historical implementation inputs. Preserve their exact bytes as the next attempt's `incorporated-revision.md` and retain its path and SHA-256 digest in that attempt's provenance; evaluation packets must reproduce those incorporated notes verbatim. Keep any new `revision-request.md` rejecting that attempt as a separate no-overwrite artifact so consecutive revision cycles retain both roles.

Before recording implementation, resolve every named external system as either:

- `reference-only`: inspect and borrow within the declared authority, but do not write; or
- `delivery-target`: create or update the authorized candidate and capture stable publication evidence.

An implementation is not ready for evaluation until every explicitly authorized delivery target is complete or documented as blocked. Never infer publication permission from a reference alone.

Persist that decision in `--targets-manifest`:

```json
{
  "targets": [
    {
      "id": "component-library",
      "system": "Example component library",
      "role": "delivery-target",
      "authorization": "The human explicitly requested publication in this run.",
      "status": "completed",
      "stableIds": ["component-123"],
      "evidence": ["https://example.invalid/components/123"]
    },
    {
      "id": "reference-board",
      "system": "Example reference board",
      "role": "reference-only",
      "authorization": null,
      "status": "reference-only",
      "stableIds": [],
      "evidence": []
    }
  ]
}
```

Use `{ "targets": [] }` when no external system is involved. A completed delivery target requires at least one stable ID or evidence record.

Prefer a clean feature branch or isolated worktree before starting. The harness captures baseline Git provenance but never auto-resets candidate code. On archive or direction iteration, preserve the evidence and report any unapproved working-tree changes.

The CLI serializes mutations with a workspace-local lock and compares state revisions before every transition. If a lock remains after a crashed process, inspect its recorded PID before removing it; never delete a lock owned by a live process.
