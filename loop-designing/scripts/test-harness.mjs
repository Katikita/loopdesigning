#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "loop.mjs");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-test-"));
const guardWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-guard-test-"));
const invalidWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-invalid-test-"));
const symlinkWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-symlink-test-"));
const symlinkOutside = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-outside-test-"));
const onboardingWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-onboarding-test-"));

function write(relativePath, value) {
  const file = path.join(workspace, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
  return file;
}

function runAt(cwd, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, `Command failed: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  const stream = expectedStatus === 0 ? result.stdout : result.stderr;
  return JSON.parse(stream);
}

function run(args, expectedStatus = 0) {
  return runAt(workspace, args, expectedStatus);
}

function evaluate(runId) {
  const gated = run(["evaluate", "--run", runId], 1);
  assert.match(gated.error, /Configured checks can execute programs/);
  assert.match(gated.details.checksSha256, /^[a-f0-9]{64}$/);
  return run(["evaluate", "--run", runId, "--checks-sha256", gated.details.checksSha256]);
}

try {
  const help = spawnSync(process.execPath, [cli, "help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /start --requirement-file <path> \(--ref <path-or-url> \| --design-context <kind=path-or-url>\) \[--ref <path-or-url>\] \[--design-context <kind=path-or-url>\]/);
  assert.match(help.stdout, /For start, supply at least one repeatable --ref or --design-context source\./);
  const onboardingInitialized = runAt(onboardingWorkspace, ["init"]);
  assert.equal(onboardingInitialized.action, "init");
  assert.deepEqual(onboardingInitialized.generatedPaths, ["loop-designing.config.json", "project-context.md"]);
  const onboardingConfig = JSON.parse(fs.readFileSync(path.join(onboardingWorkspace, "loop-designing.config.json"), "utf8"));
  assert.deepEqual(onboardingConfig.contextFiles, ["project-context.md"]);
  assert.equal(fs.readFileSync(path.join(onboardingWorkspace, "project-context.md"), "utf8"), "# Project context\n\n## Product purpose\n\n## Primary users\n\n## Current experience\n\n## Product and technical constraints\n\n## Success criteria\n");
  const duplicateInit = runAt(onboardingWorkspace, ["init"], 1);
  assert.match(duplicateInit.error, /already exists/);
  fs.writeFileSync(path.join(onboardingWorkspace, "project-context.md"), "Keep this product knowledge.\n");
  fs.writeFileSync(path.join(onboardingWorkspace, "loop-designing.config.json"), "{");
  const malformedForceInit = runAt(onboardingWorkspace, ["init", "--force"]);
  assert.deepEqual(malformedForceInit.generatedPaths, ["loop-designing.config.json"]);
  assert.equal(fs.readFileSync(path.join(onboardingWorkspace, "project-context.md"), "utf8"), "Keep this product knowledge.\n");
  const unsupportedSchemaConfig = JSON.parse(fs.readFileSync(path.join(onboardingWorkspace, "loop-designing.config.json"), "utf8"));
  unsupportedSchemaConfig.schemaVersion = 999;
  fs.writeFileSync(path.join(onboardingWorkspace, "loop-designing.config.json"), `${JSON.stringify(unsupportedSchemaConfig, null, 2)}\n`);
  const unsupportedSchemaForceInit = runAt(onboardingWorkspace, ["init", "--force"]);
  assert.deepEqual(unsupportedSchemaForceInit.generatedPaths, ["loop-designing.config.json"]);
  assert.equal(fs.readFileSync(path.join(onboardingWorkspace, "project-context.md"), "utf8"), "Keep this product knowledge.\n");
  onboardingConfig.runsDir = "runs";
  onboardingConfig.requireCleanWorktree = false;
  fs.writeFileSync(path.join(onboardingWorkspace, "loop-designing.config.json"), `${JSON.stringify(onboardingConfig, null, 2)}\n`);
  const onboardingRequirement = path.join(onboardingWorkspace, "requirement.md");
  fs.writeFileSync(onboardingRequirement, "Require design context before starting.\n");
  const noContext = runAt(onboardingWorkspace, ["start", "--id", "LD-no-context", "--requirement-file", onboardingRequirement], 1);
  assert.match(noContext.error, /Provide at least one --ref or --design-context source/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-no-context")), false);
  fs.mkdirSync(path.join(onboardingWorkspace, "fixtures"), { recursive: true });
  for (const kind of ["reference-screen", "tokens", "typography", "components", "approved-decisions", "rejected-patterns", "accessibility"]) {
    fs.writeFileSync(path.join(onboardingWorkspace, "fixtures", `${kind}.md`), `${kind} fixture\n`);
  }
  fs.symlinkSync(path.join(onboardingWorkspace, "fixtures", "tokens.md"), path.join(onboardingWorkspace, "fixtures", "tokens-link.md"));
  fs.symlinkSync(path.join(onboardingWorkspace, "fixtures", "reference-screen.md"), path.join(onboardingWorkspace, "fixtures", "reference-screen-link.md"));
  const everyKind = runAt(onboardingWorkspace, [
    "start", "--id", "LD-every-kind", "--requirement-file", onboardingRequirement,
    "--ref", "fixtures/reference-screen.md",
    "--design-context", "tokens=fixtures/tokens-link.md",
    "--design-context", "typography=fixtures/typography.md",
    "--design-context", "layout=https://example.test/layout",
    "--design-context", "components=fixtures/components.md",
    "--design-context", "approved-decisions=fixtures/approved-decisions.md",
    "--design-context", "rejected-patterns=fixtures/rejected-patterns.md",
    "--design-context", "accessibility=fixtures/accessibility.md",
  ]);
  assert.equal(everyKind.designContextSummary.sourceCount, 8);
  assert.deepEqual(everyKind.designContextSummary.suppliedKinds, ["reference-screen", "tokens", "typography", "layout", "components", "approved-decisions", "rejected-patterns", "accessibility"]);
  assert.deepEqual(everyKind.designContextSummary.missingGroups, []);
  assert.equal(everyKind.designContextSummary.sparseWarning, "");
  const everyKindState = JSON.parse(fs.readFileSync(path.join(onboardingWorkspace, "runs", "LD-every-kind", "state.json"), "utf8"));
  assert.equal(everyKindState.designContext.entries.length, 8);
  assert.match(everyKindState.designContext.manifest, /references\/design-context\.json$/);
  const everyKindManifest = JSON.parse(fs.readFileSync(path.join(onboardingWorkspace, everyKindState.designContext.manifest), "utf8"));
  assert.equal(everyKindManifest.entries.find((entry) => entry.kind === "tokens").type, "file");
  assert.equal(everyKindManifest.entries.find((entry) => entry.kind === "layout").value, "https://example.test/layout");
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-every-kind", "references", "manifest.json")), true);
  const everyKindContext = JSON.parse(fs.readFileSync(path.join(onboardingWorkspace, "runs", "LD-every-kind", "context", "manifest.json"), "utf8"));
  assert.equal(everyKindContext.designContext.summary.sourceCount, 8);
  const everyKindSnapshot = fs.readFileSync(path.join(onboardingWorkspace, "runs", "LD-every-kind", "context", "context.md"), "utf8");
  assert.match(everyKindSnapshot, /## Design context\n\n### Design system[\s\S]*### Reference screens[\s\S]*### Design rules/);
  assert.ok(everyKindSnapshot.indexOf("## Design context") < everyKindSnapshot.indexOf("## Retrieved approved memory"));
  for (const expected of [
    "- [tokens] runs/LD-every-kind/references/tokens.md",
    "- [typography] runs/LD-every-kind/references/typography.md",
    "- [layout] https://example.test/layout",
    "- [components] runs/LD-every-kind/references/components.md",
    "- [reference-screen] runs/LD-every-kind/references/reference-screen.md",
    "- [approved-decisions] runs/LD-every-kind/references/approved-decisions.md",
    "- [rejected-patterns] runs/LD-every-kind/references/rejected-patterns.md",
    "- [accessibility] runs/LD-every-kind/references/accessibility.md",
  ]) assert.match(everyKindSnapshot, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const twoSources = runAt(onboardingWorkspace, [
    "start", "--id", "LD-two-sources", "--force-new", "--requirement-file", onboardingRequirement,
    "--design-context", "tokens=fixtures/tokens.md",
    "--ref", "fixtures/reference-screen.md",
  ]);
  assert.equal(twoSources.designContextSummary.sourceCount, 2);
  assert.deepEqual(twoSources.designContextSummary.missingGroups, ["design-rules"]);
  assert.equal(twoSources.designContextSummary.sparseWarning, "");
  const malformedContext = runAt(onboardingWorkspace, ["start", "--id", "LD-malformed-context", "--requirement-file", onboardingRequirement, "--design-context", "tokens"], 1);
  assert.match(malformedContext.error, /Design context entries must use kind=source/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-malformed-context")), false);
  const missingKind = runAt(onboardingWorkspace, ["start", "--id", "LD-missing-kind", "--requirement-file", onboardingRequirement, "--design-context", "=fixtures/tokens.md"], 1);
  assert.match(missingKind.error, /Design context kind is required/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-missing-kind")), false);
  const unknownKind = runAt(onboardingWorkspace, ["start", "--id", "LD-unknown-kind", "--requirement-file", onboardingRequirement, "--design-context", "unknown=fixtures/tokens.md"], 1);
  assert.match(unknownKind.error, /Unknown design context kind/);
  assert.deepEqual(unknownKind.details, {
    kind: "unknown",
    supportedKinds: ["tokens", "typography", "layout", "components", "reference-screen", "approved-decisions", "rejected-patterns", "accessibility"],
  });
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-unknown-kind")), false);
  const emptySource = runAt(onboardingWorkspace, ["start", "--id", "LD-empty-source", "--requirement-file", onboardingRequirement, "--design-context", "tokens="], 1);
  assert.match(emptySource.error, /Design context source is required/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-empty-source")), false);
  const malformedUrl = runAt(onboardingWorkspace, ["start", "--id", "LD-malformed-url", "--force-new", "--requirement-file", onboardingRequirement, "--design-context", "layout=https://"], 1);
  assert.match(malformedUrl.error, /valid HTTP\(S\) URL/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-malformed-url")), false);
  const controlCharacterUrl = runAt(onboardingWorkspace, ["start", "--id", "LD-control-character-url", "--force-new", "--requirement-file", onboardingRequirement, "--design-context", "layout=https://example.test/x\n\n## Injected heading"], 1);
  assert.match(controlCharacterUrl.error, /control characters/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-control-character-url")), false);
  const absoluteOutsideSource = path.join(symlinkOutside, "absolute-outside.md");
  fs.writeFileSync(absoluteOutsideSource, "Outside absolute reference.\n");
  const absoluteOutside = runAt(onboardingWorkspace, ["start", "--id", "LD-absolute-outside", "--force-new", "--requirement-file", onboardingRequirement, "--ref", absoluteOutsideSource], 1);
  assert.match(absoluteOutside.error, /design context source must stay inside the workspace/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-absolute-outside")), false);
  const absoluteInsideSource = fs.realpathSync(path.join(onboardingWorkspace, "fixtures", "reference-screen.md"));
  const absoluteInside = runAt(onboardingWorkspace, ["start", "--id", "LD-absolute-inside", "--force-new", "--requirement-file", onboardingRequirement, "--ref", absoluteInsideSource]);
  assert.equal(absoluteInside.designContextSummary.sourceCount, 1);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-absolute-inside", "state.json")), true);
  const duplicateSource = runAt(onboardingWorkspace, ["start", "--id", "LD-duplicate-source", "--requirement-file", onboardingRequirement, "--ref", "fixtures/reference-screen.md", "--ref", "fixtures/reference-screen.md"], 1);
  assert.match(duplicateSource.error, /Duplicate design context kind\/source/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-duplicate-source")), false);
  const duplicateLexicalAlias = runAt(onboardingWorkspace, ["start", "--id", "LD-duplicate-lexical-alias", "--force-new", "--requirement-file", onboardingRequirement, "--ref", "fixtures/reference-screen.md", "--ref", "./fixtures/reference-screen.md"], 1);
  assert.match(duplicateLexicalAlias.error, /Duplicate design context kind\/source/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-duplicate-lexical-alias")), false);
  const duplicateSymlinkAlias = runAt(onboardingWorkspace, ["start", "--id", "LD-duplicate-symlink-alias", "--force-new", "--requirement-file", onboardingRequirement, "--ref", "fixtures/reference-screen.md", "--ref", "fixtures/reference-screen-link.md"], 1);
  assert.match(duplicateSymlinkAlias.error, /Duplicate design context kind\/source/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-duplicate-symlink-alias")), false);
  const missingLocal = runAt(onboardingWorkspace, ["start", "--id", "LD-missing-local", "--requirement-file", onboardingRequirement, "--ref", "fixtures/missing.md"], 1);
  assert.match(missingLocal.error, /Design context source must be an existing local file/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-missing-local")), false);
  const unreadableSource = path.join(onboardingWorkspace, "fixtures", "unreadable.md");
  fs.writeFileSync(unreadableSource, "Unreadable reference.\n");
  fs.chmodSync(unreadableSource, 0o000);
  let fixtureIsUnreadable = false;
  try { fs.accessSync(unreadableSource, fs.constants.R_OK); } catch { fixtureIsUnreadable = true; }
  const unreadableLocal = fixtureIsUnreadable
    ? runAt(onboardingWorkspace, ["start", "--id", "LD-unreadable-local", "--requirement-file", onboardingRequirement, "--ref", "fixtures/unreadable.md", "--force-new"], 1)
    : null;
  fs.chmodSync(unreadableSource, 0o644);
  if (unreadableLocal) {
    assert.match(unreadableLocal.error, /Design context source must be a readable local file/);
    assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-unreadable-local")), false);
  }
  const parentEscape = runAt(onboardingWorkspace, ["start", "--id", "LD-parent-escape", "--requirement-file", onboardingRequirement, "--ref", "../escape.md"], 1);
  assert.match(parentEscape.error, /design context source must stay inside the workspace/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-parent-escape")), false);
  fs.writeFileSync(path.join(symlinkOutside, "reference.md"), "Outside reference.\n");
  fs.symlinkSync(symlinkOutside, path.join(onboardingWorkspace, "fixtures", "outside-link"));
  const symlinkEscape = runAt(onboardingWorkspace, ["start", "--id", "LD-symlink-escape", "--requirement-file", onboardingRequirement, "--ref", "fixtures/outside-link/reference.md"], 1);
  assert.match(symlinkEscape.error, /design context source escapes the workspace through a symlink/);
  assert.equal(fs.existsSync(path.join(onboardingWorkspace, "runs", "LD-symlink-escape")), false);

  const initialized = run(["init"]);
  assert.equal(initialized.action, "init");
  assert.equal(fs.existsSync(path.join(workspace, "loop-designing.config.json")), true);
  assert.deepEqual(initialized.generatedPaths, ["loop-designing.config.json", "project-context.md"]);
  assert.equal(fs.existsSync(path.join(workspace, "project-context.md")), true);
  assert.equal(fs.existsSync(path.join(workspace, "loop-designing")), false);
  write("principles.md", "# Principles\n\nPrefer calm hierarchy.\n");
  write("src/candidate.txt", "before\n");
  write("memory/approved.jsonl", `${JSON.stringify({
    id: "legacy-project-entry",
    polarity: "prefer",
    kind: "preference",
    statement: "LEGACY ENTRY MUST NOT BE RETRIEVED",
    rationale: "It has no project binding.",
    scope: "project",
    tags: [],
    evidence: "Legacy fixture.",
    active: true,
  })}\n`);
  process.env.SECRET_FOR_LOOP_TEST = "must-not-leak";
  process.env.LOOP_ALLOWED = "allowed-value";
  write("loop-designing.config.json", `${JSON.stringify({
    schemaVersion: 1,
    projectId: "test-project",
    runsDir: "runs",
    conceptCount: 3,
    requireVisualEvidence: true,
    requireCleanWorktree: false,
    checkTimeoutMs: 10000,
    memory: { approved: "memory/approved.jsonl", rejected: "memory/rejected.jsonl" },
    contextFiles: ["principles.md"],
    checks: [{ id: "smoke", command: [process.execPath, "-e", "process.exit(process.env.SECRET_FOR_LOOP_TEST || process.env.LOOP_ALLOWED !== 'allowed-value' ? 1 : 0)"] }],
    checkEnvAllowlist: ["LOOP_ALLOWED"],
  }, null, 2)}\n`);
  const requirement = write("fixtures/requirement.md", "Design a calmer account overview.\n");
  write("fixtures/reference-screen.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const referenceScreen = "fixtures/reference-screen.png";
  assert.equal(spawnSync("git", ["init"], { cwd: workspace }).status, 0);
  assert.equal(spawnSync("git", ["add", "."], { cwd: workspace }).status, 0);
  assert.equal(spawnSync("git", ["-c", "user.name=Loop Test", "-c", "user.email=loop@example.test", "commit", "-m", "baseline"], { cwd: workspace }).status, 0);
  const started = run(["start", "--id", "LD-test-1", "--requirement-file", requirement, "--tag", "account", "--ref", referenceScreen]);
  assert.equal(started.state, "awaiting-concepts");
  assert.equal(started.designContextSummary.sourceCount, 1);
  assert.deepEqual(started.designContextSummary.suppliedKinds, ["reference-screen"]);
  assert.deepEqual(started.designContextSummary.missingGroups, ["design-system", "design-rules"]);
  assert.equal(typeof started.designContextSummary.sparseWarning, "string");
  assert.notEqual(started.designContextSummary.sparseWarning.length, 0);
  assert.doesNotMatch(fs.readFileSync(path.join(workspace, started.context), "utf8"), /LEGACY ENTRY MUST NOT BE RETRIEVED/);

  const earlySummary = write("fixtures/too-early.md", "Not allowed yet.\n");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const earlyEvidence = write("fixtures/too-early.png", png);
  const targets = write("fixtures/targets.json", `${JSON.stringify({ targets: [] }, null, 2)}\n`);
  const blocked = run(["implemented", "--run", "LD-test-1", "--summary-file", earlySummary, "--targets-manifest", targets, "--evidence", earlyEvidence], 1);
  assert.match(blocked.error, /Expected state awaiting-implementation/);

  const conceptFiles = ["a", "b", "c"].map((name) => write(`fixtures/${name}.png`, png));
  const conceptManifest = write("fixtures/concepts.json", `${JSON.stringify({ concepts: conceptFiles.map((artifact, index) => ({
    id: String.fromCharCode(65 + index),
    title: `Direction ${index + 1}`,
    hypothesis: `Hypothesis ${index + 1} changes one declared design variable.`,
    prompt: `Generate direction ${index + 1} from the shared requirement and context.`,
    generator: "test-fixture",
    artifact,
  })) }, null, 2)}\n`);
  const malformed = write("fixtures/malformed.png", Buffer.from("89504e470d0a1a0a", "hex"));
  const malformedManifest = write("fixtures/malformed-concepts.json", `${JSON.stringify({
    concepts: ["A", "B", "C"].map((id, index) => ({
      id,
      title: `Malformed ${id}`,
      hypothesis: `Malformed hypothesis ${id}`,
      prompt: `Malformed prompt ${id}`,
      artifact: index === 0 ? malformed : conceptFiles[index],
    })),
  }, null, 2)}\n`);
  assert.match(run(["concepts", "--run", "LD-test-1", "--manifest", malformedManifest], 1).error, /structurally valid/);
  assert.equal(run(["concepts", "--run", "LD-test-1", "--manifest", conceptManifest]).state, "awaiting-critique");

  const critiqueText = "\nChoose B. Keep its hierarchy and remove dashboard density.\n\n";
  const critique = write("fixtures/critique.md", critiqueText);
  assert.match(run(["critique", "--run", "LD-test-1", "--decision", "select", "--selection", "Z", "--notes-file", critique], 1).error, /does not match/);
  const critiqueStored = path.join(workspace, "runs/LD-test-1/critique/iteration-1.md");
  assert.equal(fs.existsSync(critiqueStored), false);
  const critiqueDir = path.join(workspace, "runs/LD-test-1/critique");
  fs.rmdirSync(critiqueDir);
  fs.symlinkSync(symlinkOutside, critiqueDir);
  assert.match(run(["critique", "--run", "LD-test-1", "--decision", "select", "--selection", "B", "--notes-file", critique], 1).error, /escapes.*symlink/);
  assert.equal(fs.existsSync(path.join(symlinkOutside, "iteration-1.md")), false);
  fs.unlinkSync(critiqueDir);
  fs.mkdirSync(critiqueDir);
  assert.equal(run(["critique", "--run", "LD-test-1", "--decision", "select", "--selection", "B", "--notes-file", critique]).state, "awaiting-implementation");
  assert.equal(fs.readFileSync(critiqueStored, "utf8"), critiqueText);

  const summary = write("fixtures/implementation.md", "Implemented concept B with the approved critique.\n");
  const evidence = write("fixtures/evidence.png", png);
  write("src/candidate.txt", "after\n");
  assert.equal(spawnSync("git", ["add", "src/candidate.txt"], { cwd: workspace }).status, 0);
  const implementation = run(["implemented", "--run", "LD-test-1", "--summary-file", summary, "--targets-manifest", targets, "--evidence", evidence]);
  assert.equal(implementation.state, "awaiting-evaluation");
  const provenance = JSON.parse(fs.readFileSync(path.join(workspace, implementation.implementation, "provenance.json"), "utf8"));
  assert.equal(provenance.untrackedFiles.some((entry) => entry.path === "fixtures/implementation.md"), true);
  assert.equal(provenance.untrackedFiles.some((entry) => entry.path.startsWith("runs/")), false);
  const archivedImplementation = provenance.untrackedFiles.find((entry) => entry.path === "fixtures/implementation.md").archived;
  assert.equal(fs.readFileSync(path.join(workspace, archivedImplementation), "utf8"), "Implemented concept B with the approved critique.\n");
  assert.match(fs.readFileSync(path.join(workspace, implementation.implementation, "changes.diff"), "utf8"), /after/);
  const evaluated = evaluate("LD-test-1");
  assert.equal(evaluated.state, "awaiting-evaluation-report");
  assert.equal(evaluated.allTechnicalChecksPassed, true);
  const packet = fs.readFileSync(path.join(workspace, evaluated.packet), "utf8");
  assert.match(packet, /Implementation evidence and provenance/);
  assert.match(packet, /fixtures\/implementation\.md/);

  const report = write("fixtures/report.json", `${JSON.stringify({
    recommendation: "pass",
    summary: "The implementation follows the selected direction.",
    findings: [{
      ruleId: "calm-hierarchy",
      source: "principles.md",
      status: "pass",
      severity: "high",
      evidence: "The evidence contains one dominant focal action.",
    }],
  }, null, 2)}\n`);
  const memory = write("fixtures/memory.json", `${JSON.stringify({ entries: [{
    polarity: "prefer",
    kind: "preference",
    statement: "Use one dominant focal action on account surfaces.",
    rationale: "The approved direction reduced scanning pressure.",
    scope: "project",
    tags: ["account", "hierarchy"],
    evidence: "Passing human verdict in LD-test-1.",
  }] }, null, 2)}\n`);
  const duplicateMemory = write("fixtures/duplicate-memory.json", `${JSON.stringify({ entries: [
    JSON.parse(fs.readFileSync(memory, "utf8")).entries[0],
    { ...JSON.parse(fs.readFileSync(memory, "utf8")).entries[0], statement: "  USE ONE DOMINANT FOCAL ACTION ON ACCOUNT SURFACES. " },
  ] }, null, 2)}\n`);
  assert.match(run(["record-evaluation", "--run", "LD-test-1", "--report", report, "--memory-proposal", duplicateMemory], 1).error, /Duplicate memory entry/);
  const recorded = run(["record-evaluation", "--run", "LD-test-1", "--report", report, "--memory-proposal", memory]);
  assert.equal(recorded.state, "awaiting-verdict");
  assert.match(recorded.memoryProposal, /memory-proposal\.json$/);
  assert.match(recorded.memoryProposalSha256, /^[a-f0-9]{64}$/);

  const verdictText = "\nPass. Approve the proposed hierarchy memory.\n\n";
  const verdict = write("fixtures/verdict.md", verdictText);
  const storedProposal = path.join(workspace, recorded.memoryProposal);
  const originalProposal = fs.readFileSync(storedProposal);
  fs.writeFileSync(storedProposal, `${fs.readFileSync(storedProposal, "utf8").trim()} \n`);
  assert.match(run(["verdict", "--run", "LD-test-1", "--decision", "pass", "--notes-file", verdict, "--memory-action", "approve"], 1).error, /changed after evaluation/);
  assert.equal(fs.existsSync(path.join(workspace, "runs/LD-test-1/verdict/iteration-1-attempt-1.md")), false);
  fs.writeFileSync(storedProposal, originalProposal);
  const memoryArtifactCollision = path.join(workspace, "runs/LD-test-1/verdict/memory-iteration-1.json");
  fs.writeFileSync(memoryArtifactCollision, "preserve me\n");
  const approvedBeforeFailedVerdict = fs.readFileSync(path.join(workspace, "memory/approved.jsonl"));
  const rejectedBeforeFailedVerdict = fs.existsSync(path.join(workspace, "memory/rejected.jsonl")) ? fs.readFileSync(path.join(workspace, "memory/rejected.jsonl")) : null;
  assert.match(run(["verdict", "--run", "LD-test-1", "--decision", "pass", "--notes-file", verdict, "--memory-action", "approve"], 1).error, /Refusing to overwrite/);
  assert.deepEqual(fs.readFileSync(path.join(workspace, "memory/approved.jsonl")), approvedBeforeFailedVerdict);
  if (rejectedBeforeFailedVerdict) assert.deepEqual(fs.readFileSync(path.join(workspace, "memory/rejected.jsonl")), rejectedBeforeFailedVerdict);
  else assert.equal(fs.existsSync(path.join(workspace, "memory/rejected.jsonl")), false);
  assert.equal(fs.readFileSync(memoryArtifactCollision, "utf8"), "preserve me\n");
  assert.equal(fs.existsSync(path.join(workspace, "runs/LD-test-1/verdict/iteration-1-attempt-1.md")), false);
  fs.unlinkSync(memoryArtifactCollision);
  const completed = run(["verdict", "--run", "LD-test-1", "--decision", "pass", "--notes-file", verdict, "--memory-action", "approve"]);
  assert.equal(completed.state, "complete");
  assert.equal(completed.promotedMemory.length, 1);
  assert.equal(fs.readFileSync(path.join(workspace, "runs/LD-test-1/verdict/iteration-1-attempt-1.md"), "utf8"), verdictText);

  const requirementTwo = write("fixtures/requirement-2.md", "Refine the account action hierarchy.\n");
  const second = run(["start", "--id", "LD-test-2", "--requirement-file", requirementTwo, "--tag", "account", "--ref", referenceScreen]);
  const context = fs.readFileSync(path.join(workspace, second.context), "utf8");
  assert.match(context, /Use one dominant focal action on account surfaces/);
  assert.equal(run(["concepts", "--run", "LD-test-2", "--manifest", conceptManifest]).state, "awaiting-critique");
  assert.equal(run(["critique", "--run", "LD-test-2", "--decision", "select", "--selection", "A", "--notes-file", critique]).state, "awaiting-implementation");
  assert.equal(run(["implemented", "--run", "LD-test-2", "--summary-file", summary, "--targets-manifest", targets, "--evidence", evidence]).state, "awaiting-evaluation");
  assert.equal(evaluate("LD-test-2").state, "awaiting-evaluation-report");
  const emptyMemory = write("fixtures/empty-memory.json", `${JSON.stringify({ entries: [] }, null, 2)}\n`);
  assert.equal(run(["record-evaluation", "--run", "LD-test-2", "--report", report, "--memory-proposal", emptyMemory]).state, "awaiting-verdict");
  const iterateImplementation = run(["verdict", "--run", "LD-test-2", "--decision", "iterate-implementation", "--notes-file", verdict]);
  assert.equal(iterateImplementation.state, "awaiting-implementation");
  assert.equal(run(["implemented", "--run", "LD-test-2", "--summary-file", summary, "--targets-manifest", targets, "--evidence", evidence]).state, "awaiting-evaluation");
  assert.equal(evaluate("LD-test-2").state, "awaiting-evaluation-report");
  assert.equal(run(["record-evaluation", "--run", "LD-test-2", "--report", report, "--memory-proposal", emptyMemory]).state, "awaiting-verdict");
  const iterateConcepts = run(["verdict", "--run", "LD-test-2", "--decision", "iterate-concepts", "--notes-file", verdict]);
  assert.equal(iterateConcepts.state, "awaiting-concepts");
  assert.equal(run(["concepts", "--run", "LD-test-2", "--manifest", conceptManifest]).state, "awaiting-critique");
  assert.equal(run(["critique", "--run", "LD-test-2", "--decision", "select", "--selection", "C", "--notes-file", critique]).state, "awaiting-implementation");
  assert.equal(run(["implemented", "--run", "LD-test-2", "--summary-file", summary, "--targets-manifest", targets, "--evidence", evidence]).state, "awaiting-evaluation");
  assert.equal(evaluate("LD-test-2").state, "awaiting-evaluation-report");
  assert.equal(run(["record-evaluation", "--run", "LD-test-2", "--report", report, "--memory-proposal", emptyMemory]).state, "awaiting-verdict");
  assert.equal(run(["verdict", "--run", "LD-test-2", "--decision", "archive", "--notes-file", verdict]).state, "archived");

  const third = run(["start", "--id", "LD-test-3", "--requirement-file", requirementTwo, "--tag", "account", "--ref", referenceScreen]);
  assert.equal(third.state, "awaiting-concepts");
  assert.equal(run(["concepts", "--run", "LD-test-3", "--manifest", conceptManifest]).state, "awaiting-critique");
  assert.equal(run(["critique", "--run", "LD-test-3", "--decision", "iterate", "--notes-file", critique]).state, "awaiting-concepts");
  assert.equal(run(["concepts", "--run", "LD-test-3", "--manifest", conceptManifest]).state, "awaiting-critique");
  assert.equal(run(["critique", "--run", "LD-test-3", "--decision", "select", "--selection", "A", "--notes-file", critique]).state, "awaiting-implementation");
  const invalidTargets = write("fixtures/invalid-targets.json", `${JSON.stringify({ targets: [{
    id: "publisher",
    system: "Example publisher",
    role: "delivery-target",
    authorization: null,
    status: "completed",
    stableIds: [],
    evidence: [],
  }] }, null, 2)}\n`);
  assert.match(run(["implemented", "--run", "LD-test-3", "--summary-file", summary, "--targets-manifest", invalidTargets, "--evidence", evidence], 1).error, /authorization source/);
  assert.equal(run(["implemented", "--run", "LD-test-3", "--summary-file", summary, "--targets-manifest", targets, "--evidence", evidence]).state, "awaiting-evaluation");
  const failingConfig = JSON.parse(fs.readFileSync(path.join(workspace, "loop-designing.config.json"), "utf8"));
  failingConfig.checks = [{ id: "intentional-failure", command: [process.execPath, "-e", "process.exit(2)"] }];
  fs.writeFileSync(path.join(workspace, "loop-designing.config.json"), `${JSON.stringify(failingConfig, null, 2)}\n`);
  const failedEvaluation = evaluate("LD-test-3");
  assert.equal(failedEvaluation.allTechnicalChecksPassed, false);
  assert.equal(failedEvaluation.results[0].exitCode, 2);
  const failReport = write("fixtures/fail-report.json", `${JSON.stringify({
    recommendation: "fail",
    summary: "The intentional technical check failed.",
    findings: [{ ruleId: "technical-check", source: "loop-designing.config.json", status: "fail", severity: "high", evidence: "intentional-failure exited with status 2." }],
  }, null, 2)}\n`);
  assert.equal(run(["record-evaluation", "--run", "LD-test-3", "--report", failReport, "--memory-proposal", emptyMemory]).state, "awaiting-verdict");
  assert.equal(run(["verdict", "--run", "LD-test-3", "--decision", "archive", "--notes-file", verdict]).state, "archived");

  const guardConfig = {
    schemaVersion: 1,
    projectId: "guard-test",
    runsDir: "runs",
    conceptCount: 3,
    requireVisualEvidence: true,
    requireCleanWorktree: true,
    memory: { approved: "memory/approved.jsonl", rejected: "memory/rejected.jsonl" },
    contextFiles: ["principles.md"],
    checks: [],
    checkEnvAllowlist: [],
  };
  fs.writeFileSync(path.join(guardWorkspace, "loop-designing.config.json"), `${JSON.stringify(guardConfig, null, 2)}\n`);
  fs.writeFileSync(path.join(guardWorkspace, "principles.md"), "Prefer clear hierarchy.\n");
  fs.writeFileSync(path.join(guardWorkspace, "requirement.md"), "Test the dirty-worktree guard.\n");
  fs.writeFileSync(path.join(guardWorkspace, "reference-screen.md"), "Guard reference screen.\n");
  assert.equal(spawnSync("git", ["init"], { cwd: guardWorkspace }).status, 0);
  assert.equal(spawnSync("git", ["add", "."], { cwd: guardWorkspace }).status, 0);
  assert.equal(spawnSync("git", ["-c", "user.name=Loop Test", "-c", "user.email=loop@example.test", "commit", "-m", "baseline"], { cwd: guardWorkspace }).status, 0);
  fs.writeFileSync(path.join(guardWorkspace, "dirty.txt"), "unrelated change\n");
  const dirtyBlocked = runAt(guardWorkspace, ["start", "--id", "LD-guard", "--requirement-file", path.join(guardWorkspace, "requirement.md"), "--ref", "reference-screen.md"], 1);
  assert.match(dirtyBlocked.error, /uncommitted changes/);
  fs.writeFileSync(path.join(guardWorkspace, "runs", ".harness.lock"), "held\n");
  const locked = runAt(guardWorkspace, ["start", "--id", "LD-locked", "--requirement-file", path.join(guardWorkspace, "requirement.md"), "--ref", "reference-screen.md", "--allow-dirty"], 1);
  assert.match(locked.error, /transition is in progress/);
  fs.unlinkSync(path.join(guardWorkspace, "runs", ".harness.lock"));

  fs.symlinkSync(symlinkOutside, path.join(symlinkWorkspace, "escaped-runs"));
  fs.writeFileSync(path.join(symlinkWorkspace, "loop-designing.config.json"), `${JSON.stringify({
    ...guardConfig,
    projectId: "symlink-test",
    runsDir: "escaped-runs",
    requireCleanWorktree: false,
  }, null, 2)}\n`);
  const symlinkBlocked = runAt(symlinkWorkspace, ["status"], 1);
  assert.match(symlinkBlocked.error, /escapes the workspace through a symlink/);
  const outsideConfig = runAt(symlinkWorkspace, ["init", "--config", path.join(symlinkOutside, "config.json")], 1);
  assert.match(outsideConfig.error, /workspace-relative/);

  fs.writeFileSync(path.join(invalidWorkspace, "loop-designing.config.json"), `${JSON.stringify({
    ...guardConfig,
    projectId: "invalid-test",
    conceptCount: 2,
    requireCleanWorktree: false,
  }, null, 2)}\n`);
  const invalidCount = runAt(invalidWorkspace, ["status"], 1);
  assert.match(invalidCount.error, /conceptCount must be exactly 3/);

  process.stdout.write("Loop Designing harness test passed.\n");
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(guardWorkspace, { recursive: true, force: true });
  fs.rmSync(invalidWorkspace, { recursive: true, force: true });
  fs.rmSync(symlinkWorkspace, { recursive: true, force: true });
  fs.rmSync(symlinkOutside, { recursive: true, force: true });
  fs.rmSync(onboardingWorkspace, { recursive: true, force: true });
}
