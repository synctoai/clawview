#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const REQUIRED_PACK_FILES = [
  "README.md",
  "app.py",
  "bin/clawview.js",
  "static/index.html",
  "static/app.js",
  "static/styles.css",
  "package.json",
];

let failed = false;

function ok(message) {
  console.log(`[publish-check] OK: ${message}`);
}

function fail(message) {
  console.error(`[publish-check] FAIL: ${message}`);
  failed = true;
}

function tryRun(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function findPython() {
  const candidates = [];
  if (process.env.CLAWVIEW_PYTHON && process.env.CLAWVIEW_PYTHON.trim()) {
    candidates.push(process.env.CLAWVIEW_PYTHON.trim());
  }
  candidates.push("python3", "python");

  for (const cmd of candidates) {
    const result = tryRun(cmd, ["--version"]);
    if (result.status === 0) {
      return cmd;
    }
  }
  return null;
}

function parseNodeEngineMin(engineRange) {
  const text = String(engineRange || "").trim();
  const match = text.match(/^>=\s*(\d+)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function checkPackageMeta(pkg) {
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  if (!pkg.name || typeof pkg.name !== "string") {
    fail("package.json missing valid name");
  } else {
    ok(`package name: ${pkg.name}`);
  }

  if (!semver.test(String(pkg.version || ""))) {
    fail(`package version is not valid semver: ${pkg.version}`);
  } else {
    ok(`package version: ${pkg.version}`);
  }

  if (!pkg.bin || !pkg.bin.clawview) {
    fail("package.json missing bin.clawview entry");
  } else {
    ok(`bin.clawview -> ${pkg.bin.clawview}`);
  }
}

function checkNodeRuntime(pkg) {
  const currentMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  const minMajor = parseNodeEngineMin(pkg.engines && pkg.engines.node);
  if (minMajor == null) {
    ok(`node version check skipped (engines.node='${(pkg.engines && pkg.engines.node) || ""}')`);
    return;
  }
  if (currentMajor < minMajor) {
    fail(`node ${process.versions.node} is lower than engines.node >=${minMajor}`);
  } else {
    ok(`node runtime ${process.versions.node} satisfies >=${minMajor}`);
  }
}

function checkPythonRuntime() {
  const python = findPython();
  if (!python) {
    fail("python runtime not found (tried CLAWVIEW_PYTHON, python3, python)");
    return;
  }
  const version = tryRun(python, ["--version"]);
  const text = (version.stdout || version.stderr || "").trim();
  ok(`python runtime detected: ${python} (${text})`);
}

function checkPackContents() {
  const packed = tryRun("npm", ["pack", "--dry-run", "--json"]);
  if (packed.status !== 0) {
    fail(`npm pack --dry-run failed: ${(packed.stderr || packed.stdout || "").trim()}`);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(packed.stdout);
  } catch (error) {
    fail(`failed to parse npm pack output: ${error.message}`);
    return;
  }

  const item = Array.isArray(parsed) ? parsed[0] : null;
  if (!item || !Array.isArray(item.files)) {
    fail("npm pack output missing files list");
    return;
  }

  const files = new Map(item.files.map((entry) => [entry.path, entry]));
  for (const required of REQUIRED_PACK_FILES) {
    if (!files.has(required)) {
      fail(`packed tarball missing required file: ${required}`);
    }
  }

  const binEntry = files.get("bin/clawview.js");
  if (binEntry && binEntry.mode !== 493) {
    fail(`bin/clawview.js is not executable in tarball (mode=${binEntry.mode})`);
  } else if (binEntry) {
    ok("bin/clawview.js executable bit is preserved");
  }

  ok(`pack dry-run ok: ${item.filename} (${item.entryCount} files, ${item.size} bytes)`);
}

function checkCliSmoke() {
  const result = tryRun("node", ["./bin/clawview.js", "--help"]);
  if (result.status !== 0) {
    fail(`CLI smoke test failed: ${(result.stderr || result.stdout || "").trim()}`);
    return;
  }
  ok("CLI smoke test passed (node ./bin/clawview.js --help)");
}

function main() {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    fail(`package.json not found: ${PACKAGE_JSON_PATH}`);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  } catch (error) {
    fail(`failed to parse package.json: ${error.message}`);
    process.exit(1);
  }

  checkPackageMeta(pkg);
  checkNodeRuntime(pkg);
  checkPythonRuntime();
  checkCliSmoke();
  checkPackContents();

  if (failed) {
    console.error("[publish-check] FAILED");
    process.exit(1);
  }
  console.log("[publish-check] PASSED");
}

main();
