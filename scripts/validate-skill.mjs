#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
const hyphenCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredScripts = ["scripts/loop.mjs", "scripts/test-harness.mjs"];
const interfaceKeys = new Set(["display_name", "short_description", "default_prompt"]);

function fail(message) {
  throw new Error(message);
}

function readFile(file, label) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") fail(`Missing ${label}: ${path.relative(process.cwd(), file) || file}`);
    throw error;
  }
}

function requireRegularFile(file, label) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    if (error.code === "ENOENT") fail(`Missing ${label}: ${path.relative(process.cwd(), file) || file}`);
    throw error;
  }
  if (!stat.isFile()) fail(`${label} must be a regular file: ${path.relative(process.cwd(), file) || file}`);
}

function scalar(value, label) {
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} must be a non-empty scalar`);
  if (/^[>|]/.test(trimmed)) fail(`${label} must be a single-line scalar`);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) fail("SKILL.md must begin with YAML frontmatter delimited by ---");
  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) fail(`Unsupported SKILL.md frontmatter line: ${line}`);
    if (fields.has(field[1])) fail(`Duplicate SKILL.md frontmatter field: ${field[1]}`);
    fields.set(field[1], scalar(field[2], `SKILL.md frontmatter ${field[1]}`));
  }
  for (const field of ["name", "description"]) {
    if (!fields.has(field) || !fields.get(field).trim()) fail(`SKILL.md frontmatter requires a non-empty ${field}`);
  }
  if (!match[2].trim()) fail("SKILL.md must contain a non-empty instruction body after frontmatter");
  return fields;
}

function validateAgentMetadata(file, skillName) {
  if (!fs.existsSync(file)) return;
  const lines = readFile(file, "agents/openai.yaml").split(/\r?\n/);
  let sawInterface = false;
  const fields = new Map();
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^interface:\s*(?:#.*)?$/.test(line)) {
      if (sawInterface) fail("agents/openai.yaml may define interface only once");
      sawInterface = true;
      continue;
    }
    const field = line.match(/^  ([a-z_]+):\s*(.*)$/);
    if (!sawInterface || !field) fail(`agents/openai.yaml only supports an interface mapping: ${line}`);
    if (!interfaceKeys.has(field[1])) fail(`agents/openai.yaml has unsupported interface key: ${field[1]}`);
    if (fields.has(field[1])) fail(`agents/openai.yaml duplicates interface key: ${field[1]}`);
    fields.set(field[1], scalar(field[2], `agents/openai.yaml interface.${field[1]}`));
  }
  if (!sawInterface) fail("agents/openai.yaml must contain an interface mapping");
  const defaultPrompt = fields.get("default_prompt");
  if (defaultPrompt && !defaultPrompt.includes(`$${skillName}`)) {
    fail(`agents/openai.yaml interface.default_prompt must invoke $${skillName}`);
  }
}

function validate(skillDirectory) {
  if (!fs.existsSync(skillDirectory) || !fs.statSync(skillDirectory).isDirectory()) {
    fail(`Skill directory does not exist: ${skillDirectory}`);
  }
  const folderName = path.basename(skillDirectory);
  if (!hyphenCase.test(folderName)) fail(`Skill folder must use hyphen-case: ${folderName}`);
  const fields = parseFrontmatter(readFile(path.join(skillDirectory, "SKILL.md"), "SKILL.md"));
  if (fields.get("name") !== folderName) {
    fail(`SKILL.md name must match its folder name (${folderName}), received ${fields.get("name")}`);
  }
  for (const script of requiredScripts) requireRegularFile(path.join(skillDirectory, script), `required script ${script}`);
  validateAgentMetadata(path.join(skillDirectory, "agents", "openai.yaml"), folderName);
}

try {
  if (!target || process.argv.length > 3) {
    fail("Usage: node scripts/validate-skill.mjs <skill-directory>");
  }
  const skillDirectory = path.resolve(target);
  validate(skillDirectory);
  process.stdout.write(`Skill structure is valid: ${path.relative(process.cwd(), skillDirectory) || "."}\n`);
} catch (error) {
  process.stderr.write(`Skill validation failed: ${error.message}\n`);
  process.exitCode = 1;
}
