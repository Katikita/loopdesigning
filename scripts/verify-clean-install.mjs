#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
const validator = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-skill.mjs");

function fail(message) {
  throw new Error(message);
}

function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`Command failed: node ${path.basename(script)} ${args.join(" ")}\n${result.stdout}${result.stderr}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(`Command did not return JSON: node ${path.basename(script)} ${args.join(" ")}`);
  }
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Cannot read ${label}: ${error.message}`);
  }
}

function verify(skillDirectory) {
  if (!fs.existsSync(skillDirectory) || !fs.statSync(skillDirectory).isDirectory()) {
    fail(`Skill directory does not exist: ${skillDirectory}`);
  }
  const validation = spawnSync(process.execPath, [validator, skillDirectory], { encoding: "utf8" });
  if (validation.status !== 0) fail(`Skill structure is invalid:\n${validation.stderr}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-clean-install-"));
  try {
    const installedSkill = path.join(root, "consumer-home", ".agents", "skills", path.basename(skillDirectory));
    const workspace = path.join(root, "consumer-workspace");
    fs.mkdirSync(path.dirname(installedSkill), { recursive: true });
    fs.mkdirSync(workspace, { recursive: true });
    fs.cpSync(skillDirectory, installedSkill, { recursive: true, errorOnExist: true, force: false });

    const cli = path.join(installedSkill, "scripts", "loop.mjs");
    const initialized = runNode(cli, ["init"], workspace);
    if (initialized.action !== "init" || !initialized.generatedPaths.includes("project-context.md")) {
      fail("Clean installation did not initialize project-context.md");
    }

    fs.writeFileSync(path.join(workspace, "project-context.md"), "# Project context\n\nProduct: Clean-install verifier\nPrimary users: beta testers\n");
    fs.writeFileSync(path.join(workspace, "requirement.md"), "Design a calm account overview.\n");
    fs.writeFileSync(path.join(workspace, "reference-screen.txt"), "Local reference fixture.\n");
    const started = runNode(cli, [
      "start", "--id", "LD-clean-install", "--requirement-file", "requirement.md", "--ref", "reference-screen.txt",
    ], workspace);
    if (started.state !== "awaiting-concepts") fail("Clean installation did not reach awaiting-concepts");

    const runDirectory = path.join(workspace, "loop-designing", "runs", "LD-clean-install");
    const state = readJson(path.join(runDirectory, "state.json"), "run state");
    if (state.status !== "awaiting-concepts" || state.designContext?.entries?.length !== 1) {
      fail("Run state does not preserve the expected design context");
    }
    const manifest = readJson(path.join(workspace, state.designContext.manifest), "design-context manifest");
    if (manifest.entries?.length !== 1 || manifest.entries[0].type !== "file") {
      fail("Design-context manifest does not contain the copied local reference");
    }
    const snapshot = fs.readFileSync(path.join(runDirectory, "context", "context.md"), "utf8");
    if (!snapshot.includes("Product: Clean-install verifier") || !snapshot.includes("reference-screen.txt")) {
      fail("Context snapshot does not contain project background and local reference provenance");
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  if (!target || process.argv.length > 3) fail("Usage: node scripts/verify-clean-install.mjs <skill-directory>");
  verify(path.resolve(target));
  process.stdout.write("Clean-install verification passed.\n");
} catch (error) {
  process.stderr.write(`Clean-install verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
