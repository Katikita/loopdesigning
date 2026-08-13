#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

const CONFIG_NAME = "loop-designing.config.json";
const TERMINAL_STATES = new Set(["complete", "archived"]);
const VALID_STATES = new Set([
  "awaiting-concepts",
  "awaiting-critique",
  "awaiting-implementation",
  "awaiting-evaluation",
  "awaiting-evaluation-report",
  "awaiting-verdict",
  "complete",
  "archived",
]);
const DESIGN_CONTEXT_GROUPS = {
  tokens: "design-system",
  typography: "design-system",
  layout: "design-system",
  components: "design-system",
  "reference-screen": "reference-screens",
  "approved-decisions": "design-rules",
  "rejected-patterns": "design-rules",
  accessibility: "design-rules",
};

class HarnessError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function die(message, details) {
  throw new HarnessError(message, details);
}

function output(payload) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? argv[++i] : true;
    if (parsed[key] === undefined) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
  }
  return parsed;
}

function list(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function designContextSummary(entries) {
  const suppliedKinds = [...new Set(entries.map((entry) => entry.kind))];
  const missingGroups = [...new Set(Object.values(DESIGN_CONTEXT_GROUPS))].filter((group) => !entries.some((entry) => entry.group === group));
  return {
    sourceCount: entries.length,
    suppliedKinds,
    missingGroups,
    sparseWarning: entries.length === 1 ? `Design context is sparse; missing ${missingGroups.join(", ")}.` : "",
  };
}

function parseDesignContextArgs(args) {
  const supplied = [
    ...list(args.ref).map((value) => ({ kind: "reference-screen", source: value })),
    ...list(args["design-context"]).map((value) => {
      if (typeof value !== "string") die("Design context entries must use kind=source");
      const separator = value.indexOf("=");
      if (separator < 0) die("Design context entries must use kind=source", value);
      return { kind: value.slice(0, separator).trim(), source: value.slice(separator + 1).trim() };
    }),
  ];
  if (!supplied.length) die("Provide at least one --ref or --design-context source");

  const seen = new Set();
  const entries = supplied.map(({ kind, source }) => {
    if (!kind) die("Design context kind is required");
    if (!Object.hasOwn(DESIGN_CONTEXT_GROUPS, kind)) die("Unknown design context kind", { kind, supportedKinds: Object.keys(DESIGN_CONTEXT_GROUPS) });
    if (typeof source !== "string" || !source.trim()) die("Design context source is required", kind);
    let value = source.trim();
    if (/[\u0000-\u001f\u007f]/.test(value)) die("Design context source must not contain control characters", kind);
    const type = /^https?:\/\//i.test(value) ? "url" : "file";
    if (type === "url") {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error("Missing HTTP(S) hostname");
        value = parsed.href;
      } catch {
        die("Design context URL must be a valid HTTP(S) URL", value);
      }
    }
    const duplicateKey = `${kind}\u0000${value}`;
    if (seen.has(duplicateKey)) die("Duplicate design context kind/source", { kind, source: value });
    seen.add(duplicateKey);
    return {
      kind,
      group: DESIGN_CONTEXT_GROUPS[kind],
      type,
      value,
    };
  });
  return { entries, summary: designContextSummary(entries) };
}

function now() {
  return new Date().toISOString();
}

function stamp() {
  return now().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    die(`Cannot read ${file}`, error.message);
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    die(`Invalid JSON in ${file}`, error.message);
  }
}

function writeText(file, value) {
  ensureDir(path.dirname(file));
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, value);
  fs.renameSync(temp, file);
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonNew(file, value) {
  writeTextNew(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextNew(file, value) {
  ensureDir(path.dirname(file));
  try {
    fs.writeFileSync(file, value, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") die("Refusing to overwrite an existing run artifact", relative(process.cwd(), file));
    die(`Cannot write ${file}`, error.message);
  }
}

function writeTextIfMissing(file, value) {
  ensureDir(path.dirname(file));
  try {
    fs.writeFileSync(file, value, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    die(`Cannot write ${file}`, error.message);
  }
}

function pathExists(pathname) {
  try {
    fs.lstatSync(pathname);
    return true;
  } catch {
    return false;
  }
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function resolveInside(root, relativePath, label) {
  if (!relativePath || typeof relativePath !== "string") die(`Missing ${label}`);
  if (path.isAbsolute(relativePath)) die(`${label} must be workspace-relative`, relativePath);
  const lexicalRoot = path.resolve(root);
  const resolved = path.resolve(lexicalRoot, relativePath);
  if (!isInside(lexicalRoot, resolved)) {
    die(`${label} must stay inside the workspace`, relativePath);
  }
  let existing = resolved;
  while (!pathExists(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) die(`Cannot resolve ${label}`, relativePath);
    existing = parent;
  }
  let realRoot;
  let realExisting;
  try {
    let existingRoot = lexicalRoot;
    while (!pathExists(existingRoot)) existingRoot = path.dirname(existingRoot);
    realRoot = fs.realpathSync(existingRoot);
    realExisting = fs.realpathSync(existing);
  } catch (error) {
    die(`${label} contains an unresolved or broken symlink`, { path: relativePath, error: error.message });
  }
  if (!isInside(realRoot, realExisting)) die(`${label} escapes the workspace through a symlink`, relativePath);
  return resolved;
}

function resolveDesignContextSource(workspace, source) {
  const lexicalRoot = path.resolve(workspace);
  const resolved = path.isAbsolute(source) ? path.resolve(source) : path.resolve(lexicalRoot, source);
  if (!isInside(lexicalRoot, resolved)) die("design context source must stay inside the workspace", source);
  return resolveInside(lexicalRoot, path.relative(lexicalRoot, resolved) || ".", "design context source");
}

function canonicalDestination(file) {
  let existing = file;
  while (!pathExists(existing)) existing = path.dirname(existing);
  return path.resolve(fs.realpathSync(existing), path.relative(existing, file));
}

function sameCanonicalDestination(first, second) {
  if (canonicalDestination(first).toLowerCase() === canonicalDestination(second).toLowerCase()) return true;
  if (!pathExists(first) || !pathExists(second)) return false;
  const firstIdentity = fs.statSync(first);
  const secondIdentity = fs.statSync(second);
  return firstIdentity.dev === secondIdentity.dev && firstIdentity.ino === secondIdentity.ino;
}

function descendant(root, label, ...parts) {
  return resolveInside(root, path.join(...parts), label);
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "artifact";
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const CRC_TABLE = Array.from({ length: 256 }, (_, number) => {
  let value = number;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function inspectPng(bytes) {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return null;
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];
  let sawIend = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== bytes.readUInt32BE(offset + 8 + length)) return null;
    if (offset === 8 && type !== "IHDR") return null;
    if (type === "IHDR") {
      if (length !== 13 || width !== undefined) return null;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
      if (!width || !height || width * height > 100_000_000 || data[10] !== 0 || data[11] !== 0 || !new Set([0, 1]).has(interlace)) return null;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") {
      if (length !== 0 || end !== bytes.length) return null;
      sawIend = true;
      break;
    }
    offset = end;
  }
  const channelsByColorType = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const allowedDepths = new Map([[0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]], [4, [8, 16]], [6, [8, 16]]]);
  if (!sawIend || !idat.length || !channelsByColorType.has(colorType) || !allowedDepths.get(colorType).includes(bitDepth)) return null;
  try {
    const decoded = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: 512 * 1024 * 1024 });
    const bitsPerPixel = channelsByColorType.get(colorType) * bitDepth;
    const passes = interlace === 0
      ? [{ x: 0, y: 0, dx: 1, dy: 1 }]
      : [
          { x: 0, y: 0, dx: 8, dy: 8 },
          { x: 4, y: 0, dx: 8, dy: 8 },
          { x: 0, y: 4, dx: 4, dy: 8 },
          { x: 2, y: 0, dx: 4, dy: 4 },
          { x: 0, y: 2, dx: 2, dy: 4 },
          { x: 1, y: 0, dx: 2, dy: 2 },
          { x: 0, y: 1, dx: 1, dy: 2 },
        ];
    let decodedOffset = 0;
    for (const pass of passes) {
      const passWidth = width > pass.x ? Math.ceil((width - pass.x) / pass.dx) : 0;
      const passHeight = height > pass.y ? Math.ceil((height - pass.y) / pass.dy) : 0;
      if (!passWidth || !passHeight) continue;
      const rowBytes = Math.ceil((passWidth * bitsPerPixel) / 8);
      for (let row = 0; row < passHeight; row += 1) {
        if (decodedOffset >= decoded.length || decoded[decodedOffset] > 4) return null;
        decodedOffset += rowBytes + 1;
      }
    }
    if (decodedOffset !== decoded.length) return null;
  } catch {
    return null;
  }
  return { format: "png", width, height };
}

function inspectJpeg(bytes) {
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  let offset = 2;
  let dimensions = null;
  let sawScan = false;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) {
      if (!sawScan) return null;
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (length < 8) return null;
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) return null;
      dimensions = { format: "jpeg", width, height };
    }
    if (marker === 0xda) sawScan = true;
    offset += length;
  }
  return dimensions && sawScan ? dimensions : null;
}

function inspectWebp(bytes) {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) return null;
  let offset = 12;
  let dimensions = null;
  let sawImageData = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.subarray(offset, offset + 4).toString("ascii");
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (dataStart + length > bytes.length) return null;
    if (type === "VP8X" && length >= 10) {
      const width = 1 + bytes.readUIntLE(dataStart + 4, 3);
      const height = 1 + bytes.readUIntLE(dataStart + 7, 3);
      dimensions = { format: "webp", width, height };
    } else if (type === "VP8L" && length >= 5 && bytes[dataStart] === 0x2f) {
      const bits = bytes.readUInt32LE(dataStart + 1);
      dimensions = { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      sawImageData = true;
    } else if (type === "VP8 " && length >= 10 && bytes.subarray(dataStart + 3, dataStart + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      dimensions = {
        format: "webp",
        width: bytes.readUInt16LE(dataStart + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataStart + 8) & 0x3fff,
      };
      sawImageData = true;
    }
    offset = dataStart + length + (length % 2);
  }
  return offset === bytes.length && sawImageData && dimensions?.width && dimensions?.height ? dimensions : null;
}

function inspectBitmapArtifact(file) {
  try {
    const bytes = fs.readFileSync(path.resolve(file));
    const inspected = inspectPng(bytes) || inspectJpeg(bytes) || inspectWebp(bytes);
    if (!inspected) return null;
    const extension = path.extname(file).toLowerCase();
    const validExtensions = inspected.format === "png" ? [".png"] : inspected.format === "jpeg" ? [".jpg", ".jpeg"] : [".webp"];
    return validExtensions.includes(extension) ? inspected : null;
  } catch {
    return null;
  }
}

function appendJsonl(file, entries) {
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
  if (entries.length) fs.appendFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function fileLengthSnapshot(file) {
  return fs.existsSync(file) ? { existed: true, bytes: fs.statSync(file).size } : { existed: false, bytes: 0 };
}

function restoreFileLength(file, snapshot) {
  if (!snapshot.existed) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  fs.truncateSync(file, snapshot.bytes);
}

function withFileLock(lockFile, action) {
  let descriptor;
  try {
    descriptor = fs.openSync(lockFile, "wx");
    fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, createdAt: now() })}\n`);
  } catch (error) {
    if (error.code === "EEXIST") die("Another Loop Designing transition is in progress", relative(process.cwd(), lockFile));
    die(`Cannot acquire transition lock ${lockFile}`, error.message);
  }
  try {
    return action();
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Preserve the original command result if lock cleanup races with external cleanup.
    }
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return readText(file)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        die(`Invalid JSONL in ${file} at line ${index + 1}`, error.message);
      }
    });
}

function loadConfig(workspace, args, allowMissing = false) {
  const configFile = resolveInside(workspace, args.config || CONFIG_NAME, "config path");
  if (!fs.existsSync(configFile)) {
    if (allowMissing) return { configFile, config: null };
    die(`Missing ${CONFIG_NAME}. Run the init command or add the project configuration.`);
  }
  const config = readJson(configFile);
  if (config.schemaVersion !== 1) die("Unsupported config schemaVersion", config.schemaVersion);
  if (!config.projectId || typeof config.projectId !== "string") die("config.projectId is required");
  if (!config.runsDir || typeof config.runsDir !== "string") die("config.runsDir is required");
  if (config.conceptCount !== 3) die("config.conceptCount must be exactly 3");
  if (config.requireVisualEvidence !== undefined && typeof config.requireVisualEvidence !== "boolean") {
    die("config.requireVisualEvidence must be a boolean");
  }
  if (!Array.isArray(config.contextFiles)) die("config.contextFiles must be an array");
  if (!Array.isArray(config.checks)) die("config.checks must be an array");
  if (config.checkEnvAllowlist !== undefined && (!Array.isArray(config.checkEnvAllowlist) || config.checkEnvAllowlist.some((name) => typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)))) {
    die("config.checkEnvAllowlist must contain valid environment variable names");
  }
  if (config.requireCleanWorktree !== undefined && typeof config.requireCleanWorktree !== "boolean") {
    die("config.requireCleanWorktree must be a boolean");
  }
  if (config.checkTimeoutMs !== undefined && (!Number.isInteger(config.checkTimeoutMs) || config.checkTimeoutMs <= 0)) {
    die("config.checkTimeoutMs must be a positive integer");
  }
  if (!config.memory || typeof config.memory !== "object") die("config.memory is required");
  if (!config.memory.approved || typeof config.memory.approved !== "string") die("config.memory.approved is required");
  if (!config.memory.rejected || typeof config.memory.rejected !== "string") die("config.memory.rejected is required");
  const checkIds = new Set();
  for (const check of config.checks) {
    if (typeof check.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(check.id) || !Array.isArray(check.command) || !check.command.length || check.command.some((part) => typeof part !== "string" || !part.length)) {
      die("Each configured check needs an id and a string-array command", check);
    }
    if (checkIds.has(check.id)) die("Configured check ids must be unique", check.id);
    checkIds.add(check.id);
  }
  return { configFile, config };
}

function pathsFor(workspace, config) {
  const runsDir = resolveInside(workspace, config.runsDir, "config.runsDir");
  const approved = resolveInside(workspace, config.memory.approved, "config.memory.approved");
  const rejected = resolveInside(workspace, config.memory.rejected, "config.memory.rejected");
  if (sameCanonicalDestination(approved, rejected)) {
    die("config approved and rejected memory stores must resolve to different files");
  }
  return { runsDir, approved, rejected };
}

function preflightContextFiles(workspace, config) {
  for (const source of config.contextFiles) {
    const sourceFile = resolveInside(workspace, source, "context file");
    if (!fs.existsSync(sourceFile)) continue;
    if (!fs.statSync(sourceFile).isFile()) die("Context source must be a regular file", source);
    try {
      fs.accessSync(sourceFile, fs.constants.R_OK);
    } catch {
      die("Context source must be readable", source);
    }
  }
}

function listRuns(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .flatMap((entry) => {
      if (!entry.isDirectory()) return [];
      const stateFile = descendant(runsDir, "run state", entry.name, "state.json");
      return fs.existsSync(stateFile) ? [readJson(stateFile)] : [];
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function getState(workspace, config, runId) {
  const { runsDir } = pathsFor(workspace, config);
  let id = runId;
  if (!id) {
    const runs = listRuns(runsDir);
    const active = runs.find((run) => !TERMINAL_STATES.has(run.status));
    id = active?.runId || runs[0]?.runId;
  }
  if (!id) die("No Loop Designing run exists");
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) die("Invalid run id", id);
  const runDir = resolveInside(runsDir, id, "run id");
  const stateFile = descendant(runDir, "run state", "state.json");
  if (!fs.existsSync(stateFile)) die(`Run ${id} does not exist`);
  const state = readJson(stateFile);
  if (!VALID_STATES.has(state.status)) die(`Run ${id} has invalid state`, state.status);
  return { runDir, stateFile, state };
}

function transition(stateFile, state, to, event, data = {}) {
  if (!VALID_STATES.has(to)) die("Invalid transition target", to);
  const current = readJson(stateFile);
  const expectedRevision = Number.isInteger(state.revision) ? state.revision : 0;
  const currentRevision = Number.isInteger(current.revision) ? current.revision : 0;
  if (currentRevision !== expectedRevision) {
    die("Run state changed during this transition; reload status and retry", { expectedRevision, currentRevision });
  }
  const at = now();
  state.transitions.push({ from: state.status, to, event, at, ...data });
  state.status = to;
  state.updatedAt = at;
  state.revision = expectedRevision + 1;
  writeJson(stateFile, state);
}

function requireState(state, expected) {
  if (state.status !== expected) die(`Expected state ${expected}; run is ${state.status}`);
}

function copyArtifact(source, destinationDir, preferredName, expectedIdentity = null) {
  const resolved = path.resolve(source);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) die("Artifact must be an existing local file", source);
  ensureDir(destinationDir);
  const ext = path.extname(resolved);
  const base = sanitizeName(preferredName || path.basename(resolved, ext));
  let destination = descendant(destinationDir, "artifact destination", `${base}${ext}`);
  let counter = 2;
  while (fs.existsSync(destination)) destination = descendant(destinationDir, "artifact destination", `${base}-${counter++}${ext}`);
  if (expectedIdentity) {
    let descriptor;
    try {
      descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const current = fs.fstatSync(descriptor);
      if (current.dev !== expectedIdentity.dev || current.ino !== expectedIdentity.ino) {
        die("Design context source changed after validation", source);
      }
      fs.writeFileSync(destination, fs.readFileSync(descriptor), { flag: "wx" });
    } catch (error) {
      if (error instanceof HarnessError) throw error;
      die("Cannot copy design context source", { source, error: error.message });
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
    return destination;
  }
  fs.copyFileSync(resolved, destination);
  return destination;
}

function preflightDesignContext(workspace, parsed) {
  const seenLocal = new Set();
  const entries = parsed.entries.map((entry) => {
    if (entry.type === "url") return entry;
    const source = resolveDesignContextSource(workspace, entry.value);
    if (!fs.existsSync(source)) die("Design context source must be an existing local file", entry.value);
    const identity = fs.statSync(source);
    if (!identity.isFile()) die("Design context source must be an existing local file", entry.value);
    try {
      fs.accessSync(source, fs.constants.R_OK);
    } catch {
      die("Design context source must be a readable local file", entry.value);
    }
    const duplicateKey = `${entry.kind}\u0000${identity.dev}\u0000${identity.ino}`;
    if (seenLocal.has(duplicateKey)) die("Duplicate design context kind/source", { kind: entry.kind, source: entry.value });
    seenLocal.add(duplicateKey);
    return { ...entry, source, copySource: fs.realpathSync(source), identity: { dev: identity.dev, ino: identity.ino } };
  });
  return { ...parsed, entries };
}

function prepareDesignContext(workspace, runDir, designContext) {
  const referencesDir = descendant(runDir, "references directory", "references");
  const entries = designContext.entries.map((entry) => {
    if (entry.type === "url") return entry;
    const stored = copyArtifact(entry.copySource, referencesDir, entry.kind, entry.identity);
    return {
      kind: entry.kind,
      group: entry.group,
      type: entry.type,
      source: entry.source,
      stored: relative(workspace, stored),
      sha256: sha256(stored),
    };
  });
  const manifestFile = descendant(referencesDir, "design context manifest", "design-context.json");
  writeJson(descendant(referencesDir, "references manifest", "manifest.json"), { references: entries });
  writeJson(manifestFile, { entries, summary: designContext.summary });
  return { manifest: relative(workspace, manifestFile), entries, summary: designContext.summary };
}

function relative(workspace, file) {
  return path.relative(workspace, file).split(path.sep).join("/");
}

function retrieveMemory(entries, config, tags) {
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  return entries.filter((entry) => {
    if (entry.active === false) return false;
    if (entry.scope === "global") return true;
    if (entry.scope === "project") return entry.project === config.projectId;
    if (entry.scope === "tag") return list(entry.tags).some((tag) => tagSet.has(String(tag).toLowerCase()));
    return false;
  });
}

function snapshotContext(workspace, config, runDir, requirement, designContext, tags, approved, rejected) {
  const labelEntry = (entry) => `- [${entry.kind}] ${entry.type === "file" ? entry.stored : entry.value}`;
  const entriesFor = (group) => designContext.entries.filter((entry) => entry.group === group);
  const sections = [
    "# Loop Designing context snapshot",
    "",
    `Project: ${config.projectId}`,
    `Created: ${now()}`,
    `Tags: ${tags.length ? tags.join(", ") : "none"}`,
    "",
    "## Requirement",
    "",
    requirement.trim(),
    "",
    "## Design context",
    "",
    "### Design system",
    "",
    ...(entriesFor("design-system").length ? entriesFor("design-system").map(labelEntry) : ["- None supplied"]),
    "",
    "### Reference screens",
    "",
    ...(entriesFor("reference-screens").length ? entriesFor("reference-screens").map(labelEntry) : ["- None supplied"]),
    "",
    "### Design rules",
    "",
    ...(entriesFor("design-rules").length ? entriesFor("design-rules").map(labelEntry) : ["- None supplied"]),
  ];

  const sources = [];
  for (const source of config.contextFiles) {
    const sourceFile = resolveInside(workspace, source, "context file");
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
      sources.push({ path: source, missing: true });
      sections.push("", `## Source: ${source}`, "", "_Missing at snapshot time._");
      continue;
    }
    const content = readText(sourceFile);
    sources.push({ path: source, sha256: sha256(sourceFile) });
    sections.push("", `## Source: ${source}`, "", content.trim());
  }

  sections.push(
    "",
    "## Retrieved approved memory",
    "",
    ...(approved.length ? approved.map((entry) => `- [${entry.id || "unversioned"}] ${entry.statement} — ${entry.rationale}`) : ["- None"]),
    "",
    "## Retrieved rejected memory",
    "",
    ...(rejected.length ? rejected.map((entry) => `- [${entry.id || "unversioned"}] ${entry.statement} — ${entry.rationale}`) : ["- None"]),
  );

  const contextDir = descendant(runDir, "context directory", "context");
  writeText(descendant(contextDir, "context snapshot", "context.md"), `${sections.join("\n")}\n`);
  writeJson(descendant(contextDir, "context manifest", "manifest.json"), { sources, designContext, approvedMemory: approved, rejectedMemory: rejected });
}

function gitSnapshot(workspace, excludedPaths = []) {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: workspace, encoding: "utf8" });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return { isGit: false, head: null, dirty: false, status: "" };
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" });
  const pathspec = [".", ...excludedPaths.map((file) => `:(exclude,literal)${relative(workspace, file)}`)];
  const status = spawnSync("git", ["status", "--short", "--", ...pathspec], { cwd: workspace, encoding: "utf8" });
  const statusText = status.status === 0 ? status.stdout : "";
  return {
    isGit: true,
    head: head.status === 0 ? head.stdout.trim() : null,
    dirty: Boolean(statusText.trim()),
    status: statusText,
  };
}

function commandInit(workspace, args) {
  const loaded = args.force
    ? { configFile: resolveInside(workspace, args.config || CONFIG_NAME, "config path"), config: null }
    : loadConfig(workspace, args, true);
  const { configFile, config } = loaded;
  if (config && !args.force) die(`${CONFIG_NAME} already exists; use --force to replace it`);
  const projectContextFile = resolveInside(workspace, "project-context.md", "project context path");
  const initial = {
    schemaVersion: 1,
    projectId: path.basename(workspace),
    runsDir: "loop-designing/runs",
    conceptCount: 3,
    requireVisualEvidence: true,
    requireCleanWorktree: true,
    checkTimeoutMs: 300000,
    memory: {
      approved: "loop-designing/memory/approved.jsonl",
      rejected: "loop-designing/memory/rejected.jsonl",
    },
    contextFiles: ["project-context.md"],
    checks: [],
    checkEnvAllowlist: [],
  };
  writeJson(configFile, initial);
  const generatedPaths = [relative(workspace, configFile)];
  if (writeTextIfMissing(projectContextFile, "# Project context\n\n## Product purpose\n\n## Primary users\n\n## Current design experience\n\n## Product and technical constraints\n\n## Success criteria\n")) {
    generatedPaths.push(relative(workspace, projectContextFile));
  }
  output({ action: "init", config: relative(workspace, configFile), generatedPaths });
}

function commandStart(workspace, config, args) {
  const parsedDesignContext = parseDesignContextArgs(args);
  const designContext = preflightDesignContext(workspace, parsedDesignContext);
  const resolved = pathsFor(workspace, config);
  ensureDir(resolved.runsDir);
  const active = listRuns(resolved.runsDir).find((run) => !TERMINAL_STATES.has(run.status));
  if (active && !args["force-new"]) die(`Active run ${active.runId} is ${active.status}; resume it or use --force-new`);

  const requirementFile = args["requirement-file"] ? path.resolve(args["requirement-file"]) : null;
  const requirement = requirementFile ? readText(requirementFile) : args.requirement;
  if (!requirement || !String(requirement).trim()) die("Provide --requirement-file or --requirement");
  const tags = list(args.tag).map(String);
  const baseline = gitSnapshot(workspace, [descendant(resolved.runsDir, "transition lock", ".harness.lock")]);
  if (config.requireCleanWorktree && baseline.isGit && baseline.dirty && !args["allow-dirty"]) {
    die("The workspace has uncommitted changes. Commit/stash them or explicitly use --allow-dirty when they belong to this run.", baseline.status);
  }
  const runId = args.id || `LD-${stamp()}`;
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) die("Run id may contain only letters, numbers, dot, underscore, and hyphen");
  const runDir = resolveInside(resolved.runsDir, runId, "run id");
  if (fs.existsSync(runDir)) die(`Run ${runId} already exists`);
  const requirementPath = descendant(runDir, "requirement artifact", "requirement.md");
  let preparedDesignContext;
  let state;
  try {
    for (const dir of ["references", "concepts", "critique", "implementation", "evaluation", "verdict", "context"]) ensureDir(descendant(runDir, `${dir} directory`, dir));
    writeText(requirementPath, `${String(requirement).trim()}\n`);
    preparedDesignContext = prepareDesignContext(workspace, runDir, designContext);
    const approved = retrieveMemory(readJsonl(resolved.approved), config, tags);
    const rejected = retrieveMemory(readJsonl(resolved.rejected), config, tags);
    snapshotContext(workspace, config, runDir, String(requirement), preparedDesignContext, tags, approved, rejected);

    const createdAt = now();
    state = {
      schemaVersion: 1,
      revision: 0,
      runId,
      projectId: config.projectId,
      status: "awaiting-concepts",
      iteration: 1,
      implementationAttempt: 0,
      evaluationAttempt: 0,
      createdAt,
      updatedAt: createdAt,
      tags,
      requirement: relative(workspace, requirementPath),
      references: preparedDesignContext.entries,
      designContext: preparedDesignContext,
      baseline,
      selectedConcept: null,
      transitions: [{ from: null, to: "awaiting-concepts", event: "start", at: createdAt }],
    };
    writeJson(descendant(runDir, "run state", "state.json"), state);
  } catch (error) {
    fs.rmSync(runDir, { recursive: true, force: true });
    throw error;
  }
  output({ action: "start", runId, state: state.status, runDir: relative(workspace, runDir), context: relative(workspace, descendant(runDir, "context snapshot", "context", "context.md")), designContextSummary: preparedDesignContext.summary });
}

function commandStatus(workspace, config, args) {
  const { runsDir } = pathsFor(workspace, config);
  if (args.run) {
    const { state, runDir } = getState(workspace, config, args.run);
    output({ action: "status", run: state, runDir: relative(workspace, runDir) });
    return;
  }
  const runs = listRuns(runsDir);
  output({ action: "status", active: runs.find((run) => !TERMINAL_STATES.has(run.status)) || null, recent: runs.slice(0, 10) });
}

function commandConcepts(workspace, config, args) {
  const { runDir, stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-concepts");
  if (!args.manifest) die("Provide --manifest");
  const manifest = readJson(path.resolve(args.manifest));
  if (!Array.isArray(manifest.concepts) || manifest.concepts.length !== config.conceptCount) {
    die(`Concept manifest must contain exactly ${config.conceptCount} concepts`);
  }
  const ids = new Set();
  const destinationDir = descendant(runDir, "concept iteration directory", "concepts", `iteration-${state.iteration}`);
  const prepared = manifest.concepts.map((concept) => {
    for (const field of ["id", "title", "hypothesis", "prompt", "artifact"]) {
      if (!concept[field] || typeof concept[field] !== "string") die(`Concept ${field} is required`, concept);
    }
    if (ids.has(concept.id)) die("Concept IDs must be unique", concept.id);
    ids.add(concept.id);
    const extension = path.extname(concept.artifact).toLowerCase();
    if (!new Set([".png", ".jpg", ".jpeg", ".webp"]).has(extension)) {
      die("Concept artifacts must be PNG, JPG, JPEG, or WebP bitmaps", concept.artifact);
    }
    const bitmap = inspectBitmapArtifact(concept.artifact);
    if (!bitmap) die("Concept artifact is not a structurally valid PNG, JPG, or WebP bitmap with matching extension", concept.artifact);
    return { concept, bitmap };
  });
  const concepts = prepared.map(({ concept, bitmap }) => {
    const artifact = copyArtifact(concept.artifact, destinationDir, `${concept.id}-${concept.title}`);
    return {
      id: concept.id,
      title: concept.title,
      hypothesis: concept.hypothesis,
      prompt: concept.prompt,
      generator: typeof concept.generator === "string" ? concept.generator : null,
      artifact: relative(workspace, artifact),
      sha256: sha256(artifact),
      bitmap,
    };
  });
  const storedManifest = descendant(destinationDir, "concept manifest", "manifest.json");
  writeJson(storedManifest, { iteration: state.iteration, concepts });
  state.conceptManifest = relative(workspace, storedManifest);
  transition(stateFile, state, "awaiting-critique", "concepts-registered", { iteration: state.iteration, conceptIds: [...ids] });
  output({ action: "concepts", runId: state.runId, state: state.status, concepts });
}

function commandCritique(workspace, config, args) {
  const { runDir, stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-critique");
  const decision = args.decision;
  if (!new Set(["select", "iterate"]).has(decision)) die("Critique decision must be select or iterate");
  if (!args["notes-file"]) die("Provide --notes-file with the human critique");
  const notes = readText(path.resolve(args["notes-file"]));
  if (!notes.trim()) die("Critique notes cannot be empty");
  let selected = null;
  if (decision === "select") {
    if (!args.selection) die("Provide --selection for a select decision");
    const manifest = readJson(resolveInside(workspace, state.conceptManifest, "concept manifest"));
    selected = manifest.concepts.find((concept) => concept.id === args.selection);
    if (!selected) die("Selection does not match a concept ID", args.selection);
  }
  const critiqueFile = descendant(runDir, "critique artifact", "critique", `iteration-${state.iteration}.md`);
  writeTextNew(critiqueFile, notes);

  try {
    if (decision === "iterate") {
      const previousIteration = state.iteration;
      state.iteration += 1;
      state.selectedConcept = null;
      state.conceptManifest = null;
      transition(stateFile, state, "awaiting-concepts", "human-critique-iterate", { previousIteration, critique: relative(workspace, critiqueFile) });
    } else {
      state.selectedConcept = selected;
      state.critique = relative(workspace, critiqueFile);
      transition(stateFile, state, "awaiting-implementation", "human-critique-select", { selection: selected.id, critique: state.critique });
    }
  } catch (error) {
    try { fs.unlinkSync(critiqueFile); } catch {}
    throw error;
  }
  output({ action: "critique", runId: state.runId, state: state.status, iteration: state.iteration, selectedConcept: state.selectedConcept });
}

function gitCapture(workspace, config, implementationDir) {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: workspace, encoding: "utf8" });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return { head: null, diff: "", status: "", untrackedFiles: [] };
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" });
  const ignoredRoots = [config.runsDir, config.memory.approved, config.memory.rejected]
    .map((entry) => path.normalize(entry).split(path.sep).join("/").replace(/^\.\//, ""));
  const pathspec = [".", ...ignoredRoots.map((root) => `:(exclude,literal)${root}`)];
  const diffOptions = ["--binary", "--no-color"];
  let diffText = "";
  if (head.status === 0) {
    const diff = spawnSync("git", ["diff", ...diffOptions, "HEAD", "--", ...pathspec], { cwd: workspace, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    diffText = diff.status === 0 ? diff.stdout : "";
  } else {
    const staged = spawnSync("git", ["diff", ...diffOptions, "--cached", "--", ...pathspec], { cwd: workspace, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const unstaged = spawnSync("git", ["diff", ...diffOptions, "--", ...pathspec], { cwd: workspace, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    diffText = `${staged.status === 0 ? staged.stdout : ""}${unstaged.status === 0 ? unstaged.stdout : ""}`;
  }
  const status = spawnSync("git", ["status", "--short", "--", ...pathspec], { cwd: workspace, encoding: "utf8" });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: workspace, encoding: "utf8" });
  const untrackedFiles = untracked.status === 0
    ? untracked.stdout.split("\0").filter(Boolean).filter((file) => {
      const normalized = path.normalize(file).split(path.sep).join("/").replace(/^\.\//, "");
      return !ignoredRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
    }).flatMap((file) => {
      const resolved = resolveInside(workspace, file, "untracked file");
      if (!pathExists(resolved)) return [];
      const stat = fs.lstatSync(resolved);
      const normalized = file.split(path.sep).join("/");
      if (stat.isSymbolicLink()) return [{ path: normalized, type: "symlink", target: fs.readlinkSync(resolved) }];
      if (!stat.isFile()) return [];
      const archived = descendant(implementationDir, "untracked implementation artifact", "untracked", ...normalized.split("/"));
      ensureDir(path.dirname(archived));
      fs.copyFileSync(resolved, archived);
      return [{ path: normalized, type: "file", sha256: sha256(archived), bytes: fs.statSync(archived).size, archived: relative(workspace, archived) }];
    })
    : [];
  return {
    head: head.status === 0 ? head.stdout.trim() : null,
    diff: diffText,
    status: status.status === 0 ? status.stdout : "",
    untrackedFiles,
  };
}

function validateTargetsManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.targets)) die("Targets manifest must contain a targets array");
  const ids = new Set();
  for (const target of manifest.targets) {
    for (const field of ["id", "system", "role", "status"]) {
      if (!target[field] || typeof target[field] !== "string") die(`Target ${field} is required`, target);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(target.id) || ids.has(target.id)) die("Target ids must be unique safe identifiers", target.id);
    ids.add(target.id);
    if (!new Set(["reference-only", "delivery-target"]).has(target.role)) die("Target role must be reference-only or delivery-target", target.role);
    if (!Array.isArray(target.stableIds) || target.stableIds.some((value) => typeof value !== "string" || !value.trim())) die("Target stableIds must be a non-empty string array", target);
    if (!Array.isArray(target.evidence) || target.evidence.some((value) => typeof value !== "string" || !value.trim())) die("Target evidence must be a non-empty string array", target);
    if (target.role === "reference-only") {
      if (target.status !== "reference-only" || target.authorization !== null) die("Reference-only targets require status reference-only and authorization null", target);
    } else {
      if (!target.authorization || typeof target.authorization !== "string") die("Delivery targets require a recorded human authorization source", target);
      if (!new Set(["completed", "blocked"]).has(target.status)) die("Delivery target status must be completed or blocked", target);
      if (target.status === "completed" && !target.stableIds.length && !target.evidence.length) {
        die("Completed delivery targets require a stable ID or publication evidence", target);
      }
    }
  }
}

function commandImplemented(workspace, config, args) {
  const { runDir, stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-implementation");
  if (!args["summary-file"]) die("Provide --summary-file");
  const summary = readText(path.resolve(args["summary-file"]));
  if (!summary.trim()) die("Implementation summary cannot be empty");
  if (!args["targets-manifest"]) die("Provide --targets-manifest, using an empty targets array when no external system is involved");
  const targets = readJson(path.resolve(args["targets-manifest"]));
  validateTargetsManifest(targets);
  const evidence = list(args.evidence).map(String);
  const inspectedEvidence = evidence.map((file) => ({ file, bitmap: inspectBitmapArtifact(file) }));
  if (config.requireVisualEvidence && !inspectedEvidence.some((entry) => entry.bitmap)) {
    die("At least one valid PNG, JPG, or WebP --evidence file is required by project config");
  }
  const pendingRevision = state.implementationRevision
    ? readText(resolveInside(workspace, state.implementationRevision, "implementation revision request"))
    : null;
  state.implementationAttempt += 1;
  state.evaluationAttempt = 0;
  const implementationDir = descendant(runDir, "implementation directory", "implementation", `iteration-${state.iteration}-attempt-${state.implementationAttempt}`);
  ensureDir(implementationDir);
  const summaryFile = descendant(implementationDir, "implementation summary", "summary.md");
  const targetsFile = descendant(implementationDir, "targets manifest", "targets.json");
  writeText(summaryFile, `${summary.trim()}\n`);
  writeJson(targetsFile, targets);
  let archivedRevision = null;
  if (pendingRevision !== null) {
    const revisionFile = descendant(implementationDir, "incorporated implementation revision", "incorporated-revision.md");
    writeTextNew(revisionFile, pendingRevision);
    archivedRevision = { path: relative(workspace, revisionFile), sha256: sha256(revisionFile) };
  }
  const storedEvidence = inspectedEvidence.map(({ file, bitmap }, index) => {
    const stored = copyArtifact(file, descendant(implementationDir, "implementation evidence directory", "evidence"), `evidence-${index + 1}`);
    return { path: relative(workspace, stored), sha256: sha256(stored), bitmap };
  });
  const git = gitCapture(workspace, config, implementationDir);
  writeText(descendant(implementationDir, "implementation diff", "changes.diff"), git.diff);
  writeJson(descendant(implementationDir, "implementation provenance", "provenance.json"), {
    baseline: state.baseline || null,
    gitHead: git.head,
    gitStatus: git.status,
    untrackedFiles: git.untrackedFiles,
    targets: { path: relative(workspace, targetsFile), sha256: sha256(targetsFile) },
    evidence: storedEvidence,
    revision: archivedRevision,
    capturedAt: now(),
  });
  state.implementation = relative(workspace, implementationDir);
  state.implementationRevision = null;
  transition(stateFile, state, "awaiting-evaluation", "implementation-recorded", { implementation: state.implementation });
  output({ action: "implemented", runId: state.runId, state: state.status, implementation: state.implementation, evidence: storedEvidence });
}

function commandReviseImplementation(workspace, config, args) {
  const { stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-evaluation");
  if (!args["notes-file"]) die("Provide --notes-file with the human's pre-evaluation implementation feedback");
  const notes = readText(path.resolve(args["notes-file"]));
  if (!notes.trim()) die("Implementation revision notes cannot be empty");
  if (!state.implementation) die("No implementation exists to revise");

  const implementationDir = resolveInside(workspace, state.implementation, "implementation");
  const revisionFile = descendant(implementationDir, "implementation revision request", "revision-request.md");
  writeTextNew(revisionFile, notes);
  try {
    state.implementationRevision = relative(workspace, revisionFile);
    transition(stateFile, state, "awaiting-implementation", "human-pre-evaluation-revision", {
      implementation: state.implementation,
      revision: state.implementationRevision,
    });
  } catch (error) {
    try { fs.unlinkSync(revisionFile); } catch {}
    throw error;
  }
  output({
    action: "revise-implementation",
    runId: state.runId,
    state: state.status,
    implementation: state.implementation,
    revision: state.implementationRevision,
  });
}

function checkApprovalFingerprint(config) {
  return crypto.createHash("sha256").update(JSON.stringify({
    checks: config.checks,
    checkEnvAllowlist: config.checkEnvAllowlist || [],
    checkTimeoutMs: config.checkTimeoutMs || 180000,
  })).digest("hex");
}

function sanitizedCheckEnvironment(allowlist) {
  const baseline = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SHELL", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM", "CI", "NODE_ENV", "NPM_CONFIG_CACHE", "XDG_CACHE_HOME", "SystemRoot", "ComSpec", "PATHEXT"];
  const environment = {};
  for (const name of new Set([...baseline, ...allowlist])) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}

function runChecks(workspace, checks, evaluationDir, timeoutMs, envAllowlist) {
  const results = [];
  const logsDir = descendant(evaluationDir, "check logs directory", "checks");
  ensureDir(logsDir);
  const checkEnvironment = sanitizedCheckEnvironment(envAllowlist);
  for (const check of checks) {
    const startedAt = now();
    const result = spawnSync(check.command[0], check.command.slice(1), {
      cwd: workspace,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      env: checkEnvironment,
    });
    const combined = `${result.stdout || ""}${result.stderr || ""}`;
    const logFile = descendant(logsDir, "check log", `${sanitizeName(check.id)}.log`);
    writeText(logFile, combined);
    results.push({
      id: check.id,
      command: check.command,
      passed: result.status === 0 && !result.error,
      exitCode: result.status,
      signal: result.signal,
      error: result.error?.message || null,
      startedAt,
      finishedAt: now(),
      log: relative(workspace, logFile),
    });
  }
  return results;
}

function commandEvaluate(workspace, config, args) {
  const { runDir, stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-evaluation");
  let checkApproval = null;
  let approval = "not-required";
  if (config.checks.length) {
    const expected = checkApprovalFingerprint(config);
    const previousApproval = state.checkApproval?.sha256 === expected ? state.checkApproval : null;
    if (args["checks-sha256"] !== expected && !previousApproval) {
      die("Configured checks can execute programs. Review the exact commands and environment allowlist, obtain explicit human approval, then rerun with --checks-sha256 <fingerprint>.", {
        checksSha256: expected,
        checks: config.checks,
        checkEnvAllowlist: config.checkEnvAllowlist || [],
        checkTimeoutMs: config.checkTimeoutMs || 180000,
      });
    }
    if (args["checks-sha256"] === expected) {
      checkApproval = {
        sha256: expected,
        checks: config.checks,
        checkEnvAllowlist: config.checkEnvAllowlist || [],
        approvedAt: now(),
      };
      approval = "approved";
    } else {
      checkApproval = { ...previousApproval, reusedAt: now() };
      approval = "reused";
    }
  }
  const previousEvaluationAttempt = Number.isInteger(state.evaluationAttempt) && state.evaluationAttempt >= 0 ? state.evaluationAttempt : 0;
  const evaluationAttempt = previousEvaluationAttempt + 1;
  const evaluationName = evaluationAttempt === 1
    ? `iteration-${state.iteration}-attempt-${state.implementationAttempt}`
    : `iteration-${state.iteration}-attempt-${state.implementationAttempt}-evaluation-${evaluationAttempt}`;
  const evaluationDir = descendant(runDir, "evaluation directory", "evaluation", evaluationName);
  ensureDir(evaluationDir);
  if (checkApproval) writeJson(descendant(evaluationDir, "check approval artifact", "check-approval.json"), checkApproval);
  const results = runChecks(workspace, config.checks, evaluationDir, config.checkTimeoutMs || 180000, config.checkEnvAllowlist || []);
  writeJson(descendant(evaluationDir, "technical evaluation artifact", "technical.json"), { allPassed: results.every((result) => result.passed), results });

  const implementationDir = resolveInside(workspace, state.implementation, "implementation");
  const provenanceFile = descendant(implementationDir, "implementation provenance", "provenance.json");
  const provenance = readJson(provenanceFile);
  const targetsFile = descendant(implementationDir, "targets manifest", "targets.json");
  const targets = readJson(targetsFile);
  const implementationRevision = provenance.revision
    ? readText(resolveInside(workspace, provenance.revision.path, "incorporated implementation revision"))
    : null;
  const stateSnapshot = JSON.stringify({
    runId: state.runId,
    iteration: state.iteration,
    selectedConcept: state.selectedConcept,
    critique: state.critique,
    implementation: state.implementation,
    implementationRevision: provenance.revision || null,
    evaluationAttempt,
    checkApproval,
  }, null, 2);
  const sections = [
    "# Evaluation packet",
    "",
    "## Run state",
    "",
    "```json",
    stateSnapshot,
    "```",
    "",
    "## Requirement and retrieved context",
    "",
    readText(descendant(runDir, "context snapshot", "context", "context.md")).trim(),
    "",
    "## Human critique",
    "",
    readText(resolveInside(workspace, state.critique, "critique")),
    ...(implementationRevision === null ? [] : [
      "",
      "## Human implementation revision",
      "",
      implementationRevision,
    ]),
    "",
    "## Implementation summary",
    "",
    readText(descendant(implementationDir, "implementation summary", "summary.md")).trim(),
    "",
    "## Delivery targets",
    "",
    "```json",
    JSON.stringify(targets, null, 2),
    "```",
    "",
    "## Implementation evidence and provenance",
    "",
    `Tracked diff: ${relative(workspace, descendant(implementationDir, "implementation diff", "changes.diff"))}`,
    "",
    "```json",
    JSON.stringify(provenance, null, 2),
    "```",
    "",
    "## Technical checks",
    "",
    ...results.map((result) => `- ${result.id}: ${result.passed ? "PASS" : "FAIL"} (${result.log})`),
  ];
  const packetFile = descendant(evaluationDir, "evaluation packet", "packet.md");
  writeText(packetFile, `${sections.join("\n")}\n`);
  state.evaluation = relative(workspace, evaluationDir);
  state.evaluationAttempt = evaluationAttempt;
  state.checkApproval = checkApproval;
  transition(stateFile, state, "awaiting-evaluation-report", "evaluation-checks-complete", { allTechnicalChecksPassed: results.every((result) => result.passed), packet: relative(workspace, packetFile), checksSha256: checkApproval?.sha256 || null });
  output({ action: "evaluate", runId: state.runId, state: state.status, approval, evaluationAttempt, allTechnicalChecksPassed: results.every((result) => result.passed), results, packet: relative(workspace, packetFile) });
}

function validateEvaluationReport(report) {
  if (!new Set(["pass", "fail"]).has(report.recommendation)) die("Evaluation recommendation must be pass or fail");
  if (!report.summary || typeof report.summary !== "string") die("Evaluation summary is required");
  if (!Array.isArray(report.findings) || !report.findings.length) die("Evaluation report needs at least one finding");
  for (const finding of report.findings) {
    for (const field of ["ruleId", "source", "status", "severity", "evidence"]) {
      if (!finding[field] || typeof finding[field] !== "string") die(`Evaluation finding ${field} is required`, finding);
    }
    if (!new Set(["pass", "fail", "not-applicable"]).has(finding.status)) die("Invalid finding status", finding.status);
    if (!new Set(["low", "medium", "high"]).has(finding.severity)) die("Invalid finding severity", finding.severity);
  }
}

function validateMemoryProposal(proposal) {
  if (!proposal || !Array.isArray(proposal.entries)) die("Memory proposal must contain an entries array");
  const seen = new Set();
  for (const entry of proposal.entries) {
    for (const field of ["polarity", "kind", "statement", "rationale", "scope", "evidence"]) {
      if (!entry[field] || typeof entry[field] !== "string") die(`Memory entry ${field} is required`, entry);
    }
    if (!new Set(["prefer", "avoid"]).has(entry.polarity)) die("Memory polarity must be prefer or avoid");
    if (!new Set(["global", "project", "tag"]).has(entry.scope)) die("Memory scope must be global, project, or tag");
    if (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== "string")) die("Memory tags must be a string array");
    if (entry.scope === "tag" && !entry.tags.length) die("Tag-scoped memory requires at least one tag");
    const fingerprint = memoryFingerprint(entry);
    if (seen.has(fingerprint)) die("Duplicate memory entry in proposal", entry.statement);
    seen.add(fingerprint);
  }
}

function memoryFingerprint(entry) {
  return crypto.createHash("sha256").update(`${entry.polarity}|${entry.scope}|${entry.statement.trim().toLowerCase()}`).digest("hex").slice(0, 12);
}

function commandRecordEvaluation(workspace, config, args) {
  const { stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-evaluation-report");
  if (!args.report) die("Provide --report");
  const report = readJson(path.resolve(args.report));
  validateEvaluationReport(report);
  if (!args["memory-proposal"]) die("Provide --memory-proposal, using an empty entries array when no reusable learning is proposed");
  const proposal = readJson(path.resolve(args["memory-proposal"]));
  validateMemoryProposal(proposal);
  const evaluationDir = resolveInside(workspace, state.evaluation, "evaluation");
  const reportFile = descendant(evaluationDir, "evaluation report", "report.json");
  const proposalFile = descendant(evaluationDir, "memory proposal", "memory-proposal.json");
  writeJsonNew(reportFile, report);
  try {
    writeJsonNew(proposalFile, proposal);
    state.evaluationReport = relative(workspace, reportFile);
    state.memoryProposal = relative(workspace, proposalFile);
    state.memoryProposalSha256 = sha256(proposalFile);
    transition(stateFile, state, "awaiting-verdict", "evaluation-report-recorded", {
      recommendation: report.recommendation,
      report: state.evaluationReport,
      memoryProposal: state.memoryProposal,
      memoryProposalSha256: state.memoryProposalSha256,
    });
  } catch (error) {
    try { fs.unlinkSync(reportFile); } catch {}
    try { fs.unlinkSync(proposalFile); } catch {}
    throw error;
  }
  output({
    action: "record-evaluation",
    runId: state.runId,
    state: state.status,
    recommendation: report.recommendation,
    report: state.evaluationReport,
    memoryProposal: state.memoryProposal,
    memoryProposalSha256: state.memoryProposalSha256,
  });
}

function normalizeMemoryProposal(proposal, config, state) {
  validateMemoryProposal(proposal);
  return proposal.entries.map((entry) => {
    const fingerprint = memoryFingerprint(entry);
    return {
      id: `MEM-${fingerprint}`,
      polarity: entry.polarity,
      kind: entry.kind,
      statement: entry.statement.trim(),
      rationale: entry.rationale.trim(),
      scope: entry.scope,
      tags: entry.tags,
      evidence: entry.evidence.trim(),
      project: config.projectId,
      sourceRun: state.runId,
      approvedAt: now(),
      active: true,
    };
  });
}

function commandVerdict(workspace, config, args) {
  const { runDir, stateFile, state } = getState(workspace, config, args.run);
  requireState(state, "awaiting-verdict");
  const decision = args.decision;
  const allowed = new Set(["pass", "retry-evaluation", "iterate-implementation", "iterate-concepts", "archive"]);
  if (!allowed.has(decision)) die("Invalid verdict decision", decision);
  const memoryAction = args["memory-action"];
  if (decision === "pass" && !new Set(["approve", "skip"]).has(memoryAction)) {
    die("A passing verdict requires --memory-action approve or --memory-action skip");
  }
  if (decision === "pass" && memoryAction === "approve" && !state.memoryProposal) {
    die("No pre-verdict memory proposal exists to approve");
  }
  if (!args["notes-file"]) die("Provide --notes-file with the human verdict");
  const notes = readText(path.resolve(args["notes-file"]));
  if (!notes.trim()) die("Verdict notes cannot be empty");
  let promoted = [];
  if (decision === "pass" && memoryAction === "approve") {
    const proposalFile = resolveInside(workspace, state.memoryProposal, "memory proposal");
    if (!state.memoryProposalSha256 || sha256(proposalFile) !== state.memoryProposalSha256) {
      die("The recorded memory proposal changed after evaluation; record the evaluation again before approval");
    }
    const proposal = readJson(proposalFile);
    promoted = normalizeMemoryProposal(proposal, config, state);
  }
  const verdictDir = descendant(runDir, "verdict directory", "verdict");
  const evaluationAttempt = Number.isInteger(state.evaluationAttempt) && state.evaluationAttempt > 0 ? state.evaluationAttempt : 1;
  const verdictName = evaluationAttempt === 1
    ? `iteration-${state.iteration}-attempt-${state.implementationAttempt}.md`
    : `iteration-${state.iteration}-attempt-${state.implementationAttempt}-evaluation-${evaluationAttempt}.md`;
  const verdictFile = descendant(verdictDir, "verdict artifact", verdictName);
  writeTextNew(verdictFile, notes);

  let memoryRollback = null;
  let memoryArtifact = null;
  let memoryArtifactCreated = false;
  try {
    if (decision === "pass" && memoryAction === "approve") {
      const memoryPaths = pathsFor(workspace, config);
      const existingApproved = new Set(readJsonl(memoryPaths.approved).map((entry) => entry.id));
      const existingRejected = new Set(readJsonl(memoryPaths.rejected).map((entry) => entry.id));
      memoryRollback = {
        approved: { file: memoryPaths.approved, snapshot: fileLengthSnapshot(memoryPaths.approved) },
        rejected: { file: memoryPaths.rejected, snapshot: fileLengthSnapshot(memoryPaths.rejected) },
      };
      appendJsonl(memoryPaths.approved, promoted.filter((entry) => entry.polarity === "prefer" && !existingApproved.has(entry.id)));
      appendJsonl(memoryPaths.rejected, promoted.filter((entry) => entry.polarity === "avoid" && !existingRejected.has(entry.id)));
      memoryArtifact = descendant(verdictDir, "promoted memory artifact", `memory-iteration-${state.iteration}.json`);
      writeJsonNew(memoryArtifact, { entries: promoted });
      memoryArtifactCreated = true;
    }

    const eventData = { decision, verdict: relative(workspace, verdictFile), promotedMemoryIds: promoted.map((entry) => entry.id) };
    if (decision === "pass") transition(stateFile, state, "complete", "human-verdict", eventData);
    else if (decision === "archive") transition(stateFile, state, "archived", "human-verdict", eventData);
    else if (decision === "retry-evaluation") {
      const previousEvaluation = {
        evaluation: state.evaluation,
        evaluationReport: state.evaluationReport,
        memoryProposal: state.memoryProposal,
      };
      state.evaluationAttempt = evaluationAttempt;
      state.evaluation = null;
      state.evaluationReport = null;
      state.memoryProposal = null;
      state.memoryProposalSha256 = null;
      transition(stateFile, state, "awaiting-evaluation", "human-verdict", { ...eventData, previousEvaluation });
    }
    else if (decision === "iterate-implementation") transition(stateFile, state, "awaiting-implementation", "human-verdict", eventData);
    else {
      const previousIteration = state.iteration;
      state.iteration += 1;
      state.selectedConcept = null;
      state.conceptManifest = null;
      state.critique = null;
      transition(stateFile, state, "awaiting-concepts", "human-verdict", { ...eventData, previousIteration });
    }
  } catch (error) {
    const rollbackErrors = [];
    if (memoryRollback) {
      for (const { file, snapshot } of Object.values(memoryRollback)) {
        try { restoreFileLength(file, snapshot); } catch (rollbackError) { rollbackErrors.push(`${file}: ${rollbackError.message}`); }
      }
    }
    if (memoryArtifactCreated && memoryArtifact) {
      try { fs.unlinkSync(memoryArtifact); } catch (rollbackError) { rollbackErrors.push(`${memoryArtifact}: ${rollbackError.message}`); }
    }
    try { fs.unlinkSync(verdictFile); } catch {}
    if (rollbackErrors.length) {
      die("Verdict failed and canonical memory rollback was incomplete; stop and repair the listed files before retrying", { originalError: error.message, rollbackErrors });
    }
    throw error;
  }
  output({ action: "verdict", runId: state.runId, state: state.status, decision, promotedMemory: promoted });
}

function printHelp() {
  process.stdout.write(`Loop Designing harness\n\nCommands:\n  init\n  status [--run <id>]\n  start --requirement-file <path> (--ref <path-or-url> | --design-context <kind=path-or-url>) [--ref <path-or-url>] [--design-context <kind=path-or-url>] [--tag <tag>] [--allow-dirty]\n  concepts --run <id> --manifest <path>\n  critique --run <id> --decision <select|iterate> --notes-file <path> [--selection <id>]\n  implemented --run <id> --summary-file <path> --targets-manifest <path> [--evidence <path>]\n  revise-implementation --run <id> --notes-file <path>\n  evaluate --run <id> [--checks-sha256 <approved-fingerprint>]\n  record-evaluation --run <id> --report <path> --memory-proposal <path>\n  verdict --run <id> --decision <pass|retry-evaluation|iterate-implementation|iterate-concepts|archive> --notes-file <path> [--memory-action <approve|skip>]\n\nFor start, supply at least one repeatable --ref or --design-context source.\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const workspace = process.cwd();

  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command === "init") {
    commandInit(workspace, args);
    return;
  }

  const { config } = loadConfig(workspace, args);
  const commands = {
    start: commandStart,
    status: commandStatus,
    concepts: commandConcepts,
    critique: commandCritique,
    implemented: commandImplemented,
    "revise-implementation": commandReviseImplementation,
    evaluate: commandEvaluate,
    "record-evaluation": commandRecordEvaluation,
    verdict: commandVerdict,
  };

  if (!commands[command]) die("Unknown command", command);
  if (command === "status") {
    commands[command](workspace, config, args);
    return;
  }
  if (command === "start") {
    preflightDesignContext(workspace, parseDesignContextArgs(args));
    preflightContextFiles(workspace, config);
  }
  const { runsDir } = pathsFor(workspace, config);
  ensureDir(runsDir);
  withFileLock(descendant(runsDir, "transition lock", ".harness.lock"), () => commands[command](workspace, config, args));
}

try {
  main();
} catch (error) {
  const payload = error instanceof HarnessError
    ? { ok: false, error: error.message, ...(error.details !== undefined ? { details: error.details } : {}) }
    : { ok: false, error: "Unexpected harness failure", details: error instanceof Error ? error.message : String(error) };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
}
