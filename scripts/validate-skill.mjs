#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
const hyphenCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredScripts = ["scripts/loop.mjs", "scripts/test-harness.mjs"];
const requiredReferences = [
  "references/configuration.md",
  "references/evaluation-contract.md",
  "references/memory-contract.md",
  "references/run-contract.md",
  "references/visual-fidelity-contract.md",
];
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
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") fail(`Missing ${label}: ${path.relative(process.cwd(), file) || file}`);
    throw error;
  }
  if (!stat.isFile()) fail(`${label} must be a non-symlink regular file: ${path.relative(process.cwd(), file) || file}`);
}

function requireNonemptyRegularFile(file, label) {
  requireRegularFile(file, label);
  if (fs.statSync(file).size === 0) fail(`${label} must be non-empty: ${path.relative(process.cwd(), file) || file}`);
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function validateLocalMarkdownLinks(skillDirectory, source) {
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let destination = match[1].trim();
    if (destination.startsWith("<") && destination.endsWith(">")) destination = destination.slice(1, -1).trim();
    else destination = destination.split(/\s+(?=["'])/, 1)[0];
    if (!destination || destination.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(destination)) continue;
    destination = destination.split("#", 1)[0].split("?", 1)[0];
    let decoded;
    try {
      decoded = decodeURIComponent(destination);
    } catch {
      fail(`SKILL.md contains an invalid encoded local link: ${destination}`);
    }
    if (path.isAbsolute(decoded)) fail(`SKILL.md local link must be skill-relative: ${destination}`);
    const resolved = path.resolve(skillDirectory, decoded);
    if (!isInside(skillDirectory, resolved)) fail(`SKILL.md local link escapes the skill directory: ${destination}`);
    requireNonemptyRegularFile(resolved, `SKILL.md local link ${destination}`);
  }
}

function assertSymlinkFreeTree(directory) {
  let rootStat;
  try {
    rootStat = fs.lstatSync(directory);
  } catch (error) {
    if (error.code === "ENOENT") fail(`Skill directory does not exist: ${directory}`);
    throw error;
  }
  if (!rootStat.isDirectory()) fail(`Skill directory must be a non-symlink directory: ${directory}`);
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) fail(`Skill directory must not contain symlinks: ${path.relative(directory, candidate)}`);
      if (stat.isDirectory()) visit(candidate);
      else if (!stat.isFile()) fail(`Skill directory may contain only regular files and directories: ${path.relative(directory, candidate)}`);
    }
  };
  visit(directory);
}

function scalar(value, label) {
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} must be a non-empty scalar`);
  if (/^[>#|&*!]/.test(trimmed)) fail(`${label} must be a non-empty string scalar`);
  if (trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "string" || !parsed.trim()) fail(`${label} must be a non-empty string`);
      return parsed.trim();
    } catch {
      fail(`${label} has an invalid double-quoted scalar`);
    }
  }
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'")) fail(`${label} has an unterminated single-quoted scalar`);
    const content = trimmed.slice(1, -1);
    if (/(^|[^'])'([^']|$)/.test(content)) fail(`${label} has an invalid single-quoted scalar`);
    const parsed = content.replace(/''/g, "'").trim();
    if (!parsed) fail(`${label} must be a non-empty string`);
    return parsed;
  }
  const plain = trimmed.replace(/\s+#.*$/, "").trim();
  if (!plain || /[\[\]{}]/.test(plain) || /:\s/.test(plain) || /[\r\n\t]/.test(plain)) {
    fail(`${label} must be a valid plain scalar`);
  }
  if (/^(?:~|null|true|false|yes|no|on|off)$/i.test(plain)
    || /^[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?(?:[eE][-+]?[0-9_]+)?$/.test(plain)
    || /^[-+]?\.(?:inf|nan)$/i.test(plain)
    || /^[-+]?0[xob][0-9a-f_]+$/i.test(plain)) {
    fail(`${label} must be a string, not a YAML null, boolean, or numeric value`);
  }
  return plain;
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
  assertSymlinkFreeTree(skillDirectory);
  const folderName = path.basename(skillDirectory);
  if (!hyphenCase.test(folderName)) fail(`Skill folder must use hyphen-case: ${folderName}`);
  const skillSource = readFile(path.join(skillDirectory, "SKILL.md"), "SKILL.md");
  requireNonemptyRegularFile(path.join(skillDirectory, "SKILL.md"), "SKILL.md");
  const fields = parseFrontmatter(skillSource);
  if (fields.get("name") !== folderName) {
    fail(`SKILL.md name must match its folder name (${folderName}), received ${fields.get("name")}`);
  }
  for (const script of requiredScripts) requireNonemptyRegularFile(path.join(skillDirectory, script), `required script ${script}`);
  for (const reference of requiredReferences) requireNonemptyRegularFile(path.join(skillDirectory, reference), `required reference ${reference}`);
  validateLocalMarkdownLinks(skillDirectory, skillSource);
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
