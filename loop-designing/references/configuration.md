# Configuration

Place `loop-designing.config.json` at the host workspace root. Run `node <skill-dir>/scripts/loop.mjs init` to create a generic starting file.

## Schema

```json
{
  "schemaVersion": 1,
  "projectId": "example-project",
  "runsDir": "intelligence/loop-runs",
  "conceptCount": 3,
  "requireVisualEvidence": true,
  "requireCleanWorktree": true,
  "checkTimeoutMs": 300000,
  "checkEnvAllowlist": [],
  "memory": {
    "approved": "intelligence/design-memory/approved.jsonl",
    "rejected": "intelligence/design-memory/rejected.jsonl"
  },
  "contextFiles": [
    "product/principles.md",
    "STYLE_GUIDE.md",
    "design/EVAL_RUBRIC.md"
  ],
  "checks": [
    {
      "id": "lint",
      "command": ["npm", "run", "lint"]
    }
  ]
}
```

## Fields

| Field | Meaning |
|---|---|
| `projectId` | Stable identifier attached to project-scoped memory |
| `runsDir` | Workspace-relative persistent run directory |
| `conceptCount` | Fixed at `3`; the harness rejects other values |
| `requireVisualEvidence` | Require at least one local evidence file before evaluation |
| `requireCleanWorktree` | Block new runs in a dirty Git worktree unless explicitly overridden |
| `checkTimeoutMs` | Per-check timeout |
| `checkEnvAllowlist` | Extra environment variable names exposed to approved checks |
| `memory.approved` | Workspace-relative JSONL store for preferred patterns |
| `memory.rejected` | Workspace-relative JSONL store for avoided patterns |
| `contextFiles` | Product principles and design rules snapshotted at run start |
| `checks` | Deterministic commands executed during evaluation |

All configured paths, including `--config`, must be workspace-relative. The harness resolves symlinks and rejects paths that escape the workspace.

Check IDs must use letters, numbers, dots, underscores, or hyphens and must be unique. Commands are string arrays executed without a shell; do not encode pipes, redirects, or shell expansion. Before execution, the harness returns a SHA-256 fingerprint over the exact commands, timeout, and environment allowlist. A human must approve that fingerprint. Checks receive a small baseline environment plus only the names in `checkEnvAllowlist`; approval still authorizes the commands to read or modify files available to the current user.

Context files are snapshotted with hashes so a later reviewer can identify which rules informed a run. Missing context files are recorded rather than silently ignored.

When a dirty start is intentional, use `--allow-dirty`. The baseline status is stored in run state and implementation provenance. The harness never resets, stashes, or deletes working-tree changes.

`init` creates only `loop-designing.config.json` and reports that path. Review the file before choosing whether to commit it, ignore it, or explicitly authorize a dirty start.

## Design context at run start

Every new run needs at least one concrete design-context source. Inventory the three groups below, show supplied sources and optional gaps, and do not invent absent context. A single source is valid but sparse; warn about the missing groups and proceed. Supply structured inputs with repeatable `--design-context kind=source`.

| Group | Supported kind | Typical source |
|---|---|---|
| Design system | `tokens`, `typography`, `layout`, `components` | Token file, type specification, layout guidance, component library |
| Reference screens | `reference-screen` | Screenshot, screen file, or screen URL |
| Design rules | `approved-decisions`, `rejected-patterns`, `accessibility` | Decision record, anti-pattern list, accessibility guidance |

`--design-context` is repeatable. Each value splits on its first `=` so a URL may contain `=`. `--ref <path-or-url>` remains repeatable for compatibility and is equivalent to `--design-context reference-screen=<path-or-url>`.

Local sources must be workspace-relative, stay inside the workspace after symlink resolution, exist, and be readable. The harness copies them into the run. HTTP(S) sources must be valid URLs with a hostname and no control characters; they are normalized, retained as URL metadata, and never fetched. Reusing the same kind/source pair is rejected as a duplicate.

The start result and `references/design-context.json` report `sourceCount`, `suppliedKinds`, `missingGroups`, and `sparseWarning`. Missing groups are optional; `sparseWarning` is non-empty when exactly one source is supplied. The generated context snapshot labels every source with its structured kind.

Minimal input:

```bash
node <skill-dir>/scripts/loop.mjs start \
  --requirement-file <path> \
  --design-context reference-screen=<path-or-url>
```

Richer input:

```bash
node <skill-dir>/scripts/loop.mjs start \
  --requirement-file <path> \
  --design-context tokens=<path> \
  --design-context typography=<path> \
  --design-context reference-screen=<path-or-url> \
  --design-context approved-decisions=<path> \
  --design-context accessibility=<path>
```
