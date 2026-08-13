# Loop Designing

**Train an AI design collaborator that becomes more aligned with your product over time.** Loop Designing turns every requirement into three visual concepts, carries human critique into implementation, checks the result against the chosen concept, and saves only the design lessons you explicitly approve.

It does not retrain the underlying model. It creates a persistent, inspectable design loop for Codex, so approved preferences and rejected patterns can inform later work without overriding your current requirement or product canon.

> **Public beta:** v0.1.0 for Node.js 18+. The workflow is usable and test-backed, but its CLI and schemas may change before a stable release. Loop Designing is an independent experiment, not an official OpenAI product. See [VERSION](VERSION) and [LICENSE](LICENSE).

## What it gives you

- Exactly three bitmap design concepts before implementation begins.
- Human selection and critique preserved verbatim across every revision.
- Deliberate use of code, existing assets, or ImageGen based on what the chosen design actually requires.
- A visual-fidelity QA gate that compares the implementation with the selected concept.
- Deterministic technical checks that run only after you approve their exact fingerprint.
- Scoped design memory promoted only after a passing human verdict and explicit approval.

## Quick start

### 1. Check requirements

You need:

- [Codex with skill support](https://learn.chatgpt.com/docs/customization/overview#skills);
- Node.js 18 or newer (`node --version`);
- access to a bitmap image-generation capability for the three concepts.

### 2. Install the skill

Clone the current public-beta branch:

```bash
git clone --branch release/v0.1.0-hardening --single-branch \
  https://github.com/Katikita/loopdesigning.git
```

Install it for your user so it is available in every project:

```bash
mkdir -p "$HOME/.agents/skills"
cp -R loopdesigning/loop-designing "$HOME/.agents/skills/"
```

Or install it only in the project where you want to design:

```bash
cd /path/to/your-product
mkdir -p .agents/skills
cp -R /path/to/loopdesigning/loop-designing .agents/skills/
```

The installable artifact is the `loop-designing/` directory. Root-level files are release and contributor tooling, so they do not need to be copied.

After installation, open your product workspace in Codex and start a new task so Codex discovers the skill.

### 3. Start your first design loop

Place at least one real reference inside your product workspace. It can be a screenshot, design file, design-system document, or HTTP(S) URL. Then paste a request like this into Codex:

```text
$loop-designing

Start a new design run.

Requirement:
Design a focused mobile account overview that makes available cash and upcoming payments easy to scan.

Reference:
- ./references/account-layout.png
```

`./references/account-layout.png` is an example: replace it with a file that actually exists in your workspace. A new run needs at least one concrete local file or HTTP(S) URL.

On first use, the skill creates:

- `loop-designing.config.json` for project paths, context, memory, and technical checks;
- `project-context.md` for product purpose, users, current design experience, constraints, and success criteria.

Review those files when Codex presents them. The skill recommends useful background but will not invent it or block the run when you choose to proceed with limited context.

## What happens during a run

1. **Onboard and snapshot context.** The requirement, supplied references, product canon, and applicable memory are preserved with the run.
2. **Generate concepts.** Codex creates exactly three genuinely different bitmap concepts and shows all three.
3. **Choose or redirect.** You select A, B, or C with critique, or request another concept iteration.
4. **Implement the selection.** Codex implements only the selected direction and your critique. If an important visual cannot be faithfully reproduced in code, it explains the limitation and asks whether to use ImageGen, use an existing asset, or accept a named simplified approximation.
5. **Compare concept and render.** Before evaluation, the skill compares the implementation with the chosen concept, makes up to two internal correction passes, and returns unresolved high-impact differences to you.
6. **Evaluate.** The run combines visual evidence, project rules, approved memory, provenance, and configured technical checks. If a check exists, you see and approve its exact command fingerprint before it runs.
7. **Give the verdict.** You can pass, retry a faulty evaluation, revise the implementation, return to concepts, or archive the run.
8. **Approve learning.** On a pass, you separately approve or skip the proposed reusable memory.

Every transition and rejected attempt remains inspectable. The evaluator never approves its own work.

## Give it your design context

One source is enough to begin, but richer context improves alignment. Useful inputs fall into three optional groups:

```text
design-system/
  tokens
  typography
  layout
  components

reference-screens/
  dashboard
  detail
  form

design-rules/
  approved-decisions
  rejected-patterns
  accessibility
```

These folder names are suggestions, not a required structure. Supply only the files your project actually has.

### Add product canon

Use `design.md` for authoritative product and design-system rules. After initialization, include it in `loop-designing.config.json`:

```json
{
  "contextFiles": [
    "project-context.md",
    "design.md"
  ]
}
```

Configured context files are snapshotted at the start of each run. Keep learned memory separate; do not copy it into `design.md` or create a hand-maintained `memory.md` as a second source of truth.

### Add structured references to a run

When using the advanced CLI, label each source by its role:

```bash
node /path/to/loop-designing/scripts/loop.mjs start \
  --requirement-file ./requirements/account-overview.md \
  --design-context tokens=./design-system/tokens.json \
  --design-context typography=./design-system/typography.md \
  --design-context reference-screen=./reference-screens/dashboard.png \
  --design-context approved-decisions=./design-rules/approved-decisions.md \
  --design-context accessibility=./design-rules/accessibility.md
```

Missing groups are optional. The harness warns when only one source is present but still starts the run.

## How memory improves alignment

Run history remembers all requirements, concepts, critiques, implementation attempts, evaluations, and verdicts as evidence. Canonical design memory is narrower: a lesson is stored only when an evaluation proposes it, you pass the implementation, and you explicitly approve the proposal.

The default stores are managed JSONL files:

```text
loop-designing/memory/approved.jsonl
loop-designing/memory/rejected.jsonl
```

Future runs retrieve active memory by scope:

- **project:** only for the same configured project;
- **tag:** only for runs sharing a tag;
- **global:** across projects, used sparingly;
- **rejected:** kept separately as warnings and anti-patterns.

Decision authority remains:

1. the current requirement and explicit human direction;
2. product canon such as `design.md` and other configured context files;
3. applicable approved memory;
4. rejected memory as warnings.

If memory conflicts with product canon, the evaluator marks it inapplicable and surfaces the conflict. The loop can therefore become more aligned through repeated, focused, human-approved lessons, but improvement is not automatic and memory never silently rewrites your design system.

## Advanced CLI

Most users should work through `$loop-designing`; the skill drives the state machine and stops at each human gate. The CLI is available for inspection, automation, and debugging.

Run commands from the product workspace root:

```bash
node /path/to/loop-designing/scripts/loop.mjs init
node /path/to/loop-designing/scripts/loop.mjs status
node /path/to/loop-designing/scripts/loop.mjs start \
  --requirement-file ./requirements/account-overview.md \
  --ref ./references/account-layout.png
```

`--ref` is repeatable shorthand for `--design-context reference-screen=<source>`. Local references are copied into the run; HTTP(S) references are recorded as URLs and are never fetched by the harness.

For every transition and schema, see:

- [configuration](loop-designing/references/configuration.md);
- [run contract](loop-designing/references/run-contract.md);
- [visual-fidelity contract](loop-designing/references/visual-fidelity-contract.md);
- [evaluation contract](loop-designing/references/evaluation-contract.md);
- [memory contract](loop-designing/references/memory-contract.md).

## Safety and control

- The harness never chooses a concept or final verdict for you.
- Passing automated checks never equals design approval.
- Configured checks require fingerprint-bound human approval before execution.
- External systems remain read-only unless you explicitly authorize a named delivery target.
- ImageGen is not used for implementation assets without your explicit choice.
- Important asset-dependent visuals are not silently replaced with code approximations.
- Tag- or project-scoped learning is never silently broadened to global memory.
- Dirty-worktree protection, path containment, state locking, and memory rollback protect persisted runs.

## Validate and contribute

The harness has no package dependencies and uses only Node's standard library. From the repository root, run:

```bash
node --check loop-designing/scripts/loop.mjs
node loop-designing/scripts/test-harness.mjs
node scripts/test-release.mjs
node scripts/validate-skill.mjs loop-designing
node scripts/verify-clean-install.mjs loop-designing
```

The harness test covers the complete pass path, both design-iteration routes, consecutive implementation revisions, evaluation retries, command approval, environment filtering, scoped memory and rollback, bitmap validation, provenance, dirty-worktree protection, locking, and symlink containment.

The release tests validate the installable skill structure and copy only `loop-designing/` into a clean temporary consumer workspace before initializing and starting a real run. CI runs the suite on Node.js 18, 22, and 24.

Contributions should preserve the human gates, archived evidence, product-canon priority, explicit asset decisions, and clean-install boundary.

## Repository structure

```text
loopdesigning/
├── README.md
├── LICENSE
├── VERSION
├── loop-designing/              # installable Codex skill
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   ├── references/
│   │   ├── configuration.md
│   │   ├── evaluation-contract.md
│   │   ├── memory-contract.md
│   │   ├── run-contract.md
│   │   └── visual-fidelity-contract.md
│   └── scripts/
│       ├── loop.mjs
│       └── test-harness.mjs
└── scripts/                      # release validation tooling
```

## Current boundaries

Loop Designing is a workflow harness, not a design model, hosted service, or replacement for human taste. It currently assumes bitmap concept generation and a filesystem-backed project workspace. URL references are preserved as provenance rather than downloaded content.

The standalone `loop-designing/` folder is the installable artifact and authoring source of truth. Packaging it as a distributable Codex plugin may be a future distribution step.
