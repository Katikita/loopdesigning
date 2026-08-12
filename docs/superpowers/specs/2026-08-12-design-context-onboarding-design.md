# Design Context Onboarding

## Goal

Require every new Loop Designing run to begin with at least one concrete source of design truth, while making the broader design-system checklist advisory and preserving existing `--ref` usage.

## User experience

Before starting a run, the skill inventories available inputs in three optional groups:

- Design system: tokens, typography, layout, components.
- Reference screens: dashboard, detail, form, or an equivalent representative screen.
- Design rules: approved decisions, rejected patterns, accessibility requirements.

The labels are examples, not prescribed filenames or mandatory product screen types. A user may supply any relevant file or URL from any group. One valid source across all groups is the minimum. The skill reports what was supplied, identifies uncovered groups as optional gaps, and warns that sparse context reduces consistency.

If no source is available, the skill pauses and asks for one. It does not invent a design canon or proceed from an unsupported verbal claim that a design system exists.

## CLI contract

`start` accepts a repeatable structured option:

```text
--design-context <kind>=<path-or-url>
```

Supported `kind` values are:

- `tokens`
- `typography`
- `layout`
- `components`
- `reference-screen`
- `approved-decisions`
- `rejected-patterns`
- `accessibility`

Existing repeatable `--ref <path-or-url>` values remain valid and count as `reference-screen` context for backward compatibility. A run starts only when at least one `--design-context` or `--ref` value is present.

Each structured value must contain a supported kind, `=`, and a non-empty source. Local sources must resolve to readable files inside the host workspace. URLs retain the harness's existing URL behavior. Duplicate kind/source pairs are rejected so the persisted inventory is unambiguous.

Successful `start` output includes a compact `designContextSummary` with supplied kinds, optional missing groups, source count, and a sparse-context warning when only one source is supplied.

## Persistence and evaluation

The run stores a design-context manifest alongside the existing references manifest. Local artifacts use the existing safe copy and containment behavior; URLs are recorded without fetching. The context snapshot includes the categorized inventory before project rules and memory so concept generation and evaluation share the same source of truth.

Run state records the manifest path and summary. Prior artifacts, iteration behavior, human gates, memory promotion, and external-delivery authorization remain unchanged.

## Skill guidance

`SKILL.md` adds a concise onboarding step before `start`:

1. Inventory the three optional groups.
2. Ask for missing information without implying every item is required.
3. Require at least one concrete source.
4. Explain the limitations of sparse context.
5. Pass categorized inputs to the CLI and read the generated snapshot.

Detailed category and CLI syntax documentation belongs in `references/configuration.md` to keep the frequently loaded skill body concise. The repository README shows one minimal start and one richer example.

## Compatibility

The change intentionally tightens `start`: a requirement with no reference or categorized design context is rejected. Existing calls that already pass `--ref` continue to work unchanged. Config schema version remains `1` because the input contract changes without adding required configuration fields.

## Error handling

Errors identify the actionable problem:

- No context: provide at least one `--ref` or `--design-context` source.
- Unknown kind: list the supported kinds.
- Malformed structured value: show the required `kind=source` form.
- Missing or unsafe local source: reuse existing file and workspace-containment errors.
- Duplicate source: identify the repeated kind/source pair.

No partial run directory or state file may remain after validation fails.

## Testing and publication QA

Development follows test-first behavior changes. Extend the integration harness to prove:

- `start` fails with zero design inputs and leaves no run artifacts.
- A legacy `--ref` starts successfully and is categorized as a reference screen.
- Each structured kind is accepted.
- Multiple structured inputs are persisted and summarized.
- Unknown, malformed, duplicate, missing, and unsafe local inputs fail clearly.
- One source produces the sparse-context warning; broader coverage reports optional gaps without blocking.
- Existing concept, critique, implementation, evaluation, verdict, memory, locking, dirty-worktree, bitmap, and symlink tests remain green.

Publication QA also includes Node syntax checks, the full harness, skill-folder structural validation, frontmatter and agent-metadata consistency review, README command verification, a clean diff review, and fresh-context forward tests of onboarding behavior. Node 18 compatibility should be tested when a Node 18 runtime is available; otherwise that limitation must be reported rather than inferred.

## Out of scope

- Generating a design system for users who have none.
- Requiring all checklist categories or three specific screen names.
- Fetching or snapshotting URL contents.
- Chronicle integration or automatic memory promotion.
- Publishing, pushing, or opening a pull request without separate explicit authorization.
