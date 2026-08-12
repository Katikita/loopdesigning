#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = path.join(root, "scripts", "validate-skill.mjs");
const verifier = path.join(root, "scripts", "verify-clean-install.mjs");
const sourceSkill = path.join(root, "loop-designing");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "loop-designing-release-test-"));

function copySkill(name) {
  const destination = path.join(fixtureRoot, name, "loop-designing");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(sourceSkill, destination, { recursive: true });
  return destination;
}

function run(script, skillDirectory, expectedStatus, label) {
  const result = spawnSync(process.execPath, [script, skillDirectory], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, `${label} expected status ${expectedStatus}, received ${result.status}\n${result.stdout}${result.stderr}`);
}

function rejects(name, configure) {
  const skill = copySkill(name);
  configure(skill);
  run(validator, skill, 1, `${name} validator`);
  run(verifier, skill, 1, `${name} clean-install verifier`);
}

try {
  run(validator, sourceSkill, 0, "positive validator");
  run(verifier, sourceSkill, 0, "positive clean-install verifier");

  rejects("missing-skill", (skill) => fs.rmSync(path.join(skill, "SKILL.md")));
  rejects("missing-cli", (skill) => fs.rmSync(path.join(skill, "scripts", "loop.mjs")));
  rejects("final-script-symlink", (skill) => {
    const cli = path.join(skill, "scripts", "loop.mjs");
    const external = path.join(path.dirname(skill), "external-loop.mjs");
    fs.renameSync(cli, external);
    fs.symlinkSync(external, cli);
  });
  rejects("root-symlink", (skill) => {
    const target = path.join(path.dirname(skill), "real-skill");
    fs.renameSync(skill, target);
    fs.symlinkSync(target, skill);
  });
  rejects("scripts-directory-symlink", (skill) => {
    const scripts = path.join(skill, "scripts");
    const target = path.join(skill, "script-files");
    fs.renameSync(scripts, target);
    fs.symlinkSync(target, scripts);
  });
  rejects("malformed-frontmatter", (skill) => {
    fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: loop-designing\ndescription: \"unterminated\n---\n\n# Instructions\n");
  });
  rejects("malformed-frontmatter-brackets", (skill) => {
    fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: loop-designing\ndescription: [unterminated\n---\n\n# Instructions\n");
  });
  rejects("comment-only-description", (skill) => {
    fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: loop-designing\ndescription: # comment only\n---\n\n# Instructions\n");
  });
  rejects("boolean-description", (skill) => {
    fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: loop-designing\ndescription: true\n---\n\n# Instructions\n");
  });
  rejects("malformed-agent-metadata", (skill) => {
    fs.writeFileSync(path.join(skill, "agents", "openai.yaml"), "interface:\n  display_name: \"unterminated\n");
  });
  rejects("malformed-agent-structure", (skill) => {
    fs.writeFileSync(path.join(skill, "agents", "openai.yaml"), "interface:\n display_name: Loop Designing\n");
  });
  rejects("boolean-agent-metadata", (skill) => {
    fs.writeFileSync(path.join(skill, "agents", "openai.yaml"), "interface:\n  display_name: true\n");
  });
  rejects("null-agent-metadata", (skill) => {
    fs.writeFileSync(path.join(skill, "agents", "openai.yaml"), "interface:\n  display_name: # comment only\n");
  });

  process.stdout.write("Loop Designing release regression test passed.\n");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
