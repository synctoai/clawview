#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const readline = require("readline/promises");

const APP_PATH = path.resolve(__dirname, "..", "app.py");
const HOME_DIR = os.homedir();
const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8788,
  stateDir: "~/.openclaw",
  historyRoot: "~/.clawview",
  autoOpen: true,
};
const DEFAULT_CONFIG_PATH = path.join(HOME_DIR, ".clawview", "config.json");
const CONFIG_PATH = resolveUserPath(process.env.CLAWVIEW_CONFIG || DEFAULT_CONFIG_PATH);
const RUN_DIR = path.join(HOME_DIR, ".clawview", "run");
const PID_FILE = path.join(RUN_DIR, "clawview.pid");
const LOG_FILE = path.join(RUN_DIR, "clawview.log");

function printHelp() {
  console.log(`clawview - OpenClaw session web viewer\n
Usage:
  clawview [options]
  clawview config <show|set|get|reset|path> [options]

Options:
  --configure           Run setup wizard and save defaults
  --reset-config        Remove saved config file
  --print-config        Print current effective config
  --silent              Start in background and return immediately
  --stop                Stop background process started by --silent
  --status              Show server status from current config
  --host <host>         Override bind host (default: 127.0.0.1)
  --port, -p <port>     Override bind port (default: 8788)
  --state-dir <path>    Override OpenClaw state directory
  --history-root <path> Override history root directory
  --open                Force open browser
  --no-open             Disable opening browser
  -h, --help            Show help

Environment:
  CLAWVIEW_CONFIG       Custom config file path
  CLAWVIEW_PYTHON       Python executable path
  CLAWVIEW_NO_BROWSER=1 Disable browser open action`);
}

function printConfigHelp() {
  console.log(`clawview config - manage saved defaults\n
Usage:
  clawview config show
  clawview config path
  clawview config get <key>
  clawview config set [--host <host>] [--port <port>] [--state-dir <path>] [--history-root <path>] [--auto-open <true|false>]
  clawview config reset

Keys:
  host | port | stateDir | historyRoot | autoOpen

Examples:
  clawview config set --port 9000
  clawview config set --auto-open false
  clawview config get port`);
}

function resolveUserPath(input) {
  if (!input || typeof input !== "string") return input;
  if (input === "~") return HOME_DIR;
  if (input.startsWith("~/")) return path.join(HOME_DIR, input.slice(2));
  return path.resolve(input);
}

function normalizeConfig(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const port = Number.parseInt(String(obj.port ?? DEFAULT_CONFIG.port), 10);
  return {
    host: typeof obj.host === "string" && obj.host.trim() ? obj.host.trim() : DEFAULT_CONFIG.host,
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_CONFIG.port,
    stateDir:
      typeof obj.stateDir === "string" && obj.stateDir.trim() ? obj.stateDir.trim() : DEFAULT_CONFIG.stateDir,
    historyRoot:
      typeof obj.historyRoot === "string" && obj.historyRoot.trim()
        ? obj.historyRoot.trim()
        : DEFAULT_CONFIG.historyRoot,
    autoOpen: typeof obj.autoOpen === "boolean" ? obj.autoOpen : DEFAULT_CONFIG.autoOpen,
  };
}

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { exists: false, config: { ...DEFAULT_CONFIG } };
    }
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { exists: true, config: normalizeConfig({ ...DEFAULT_CONFIG, ...data }) };
  } catch (error) {
    console.error(`[clawview] failed to read config: ${error.message}`);
    return { exists: false, config: { ...DEFAULT_CONFIG } };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalizeConfig(config), null, 2) + "\n", "utf8");
}

function parseBooleanInput(raw, fallback) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return fallback;
  if (["y", "yes", "1", "true"].includes(value)) return true;
  if (["n", "no", "0", "false"].includes(value)) return false;
  return fallback;
}

function parseBooleanLiteral(raw, flagName) {
  const value = String(raw || "").trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(value)) return true;
  if (["0", "false", "no", "n"].includes(value)) return false;
  throw new Error(`Invalid boolean for ${flagName}: ${raw}`);
}

async function runConfigureWizard(baseConfig) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const stateDir = (await rl.question(`OpenClaw state dir [${baseConfig.stateDir}]: `)).trim() || baseConfig.stateDir;
    const historyRoot =
      (await rl.question(`History root dir [${baseConfig.historyRoot}]: `)).trim() || baseConfig.historyRoot;
    const host = (await rl.question(`Host [${baseConfig.host}]: `)).trim() || baseConfig.host;

    let port = baseConfig.port;
    while (true) {
      const value = (await rl.question(`Port [${baseConfig.port}]: `)).trim();
      if (!value) break;
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
        port = parsed;
        break;
      }
      console.error("Invalid port. Please enter an integer between 1 and 65535.");
    }

    const openAnswer = await rl.question(
      `Open browser after startup? (${baseConfig.autoOpen ? "Y/n" : "y/N"}): `
    );
    const autoOpen = parseBooleanInput(openAnswer, baseConfig.autoOpen);

    return normalizeConfig({ stateDir, historyRoot, host, port, autoOpen });
  } finally {
    rl.close();
  }
}

function normalizeConfigKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  if (raw === "host") return "host";
  if (raw === "port") return "port";
  if (raw === "stateDir" || raw === "state-dir") return "stateDir";
  if (raw === "historyRoot" || raw === "history-root") return "historyRoot";
  if (raw === "autoOpen" || raw === "auto-open") return "autoOpen";
  return null;
}

function parseConfigCommand(argv) {
  if (argv.length === 0) {
    return { action: "show" };
  }

  const sub = argv[0];
  if (sub === "--help" || sub === "-h" || sub === "help") {
    return { action: "help" };
  }
  if (sub === "show") {
    return { action: "show" };
  }
  if (sub === "path") {
    return { action: "path" };
  }
  if (sub === "reset") {
    return { action: "reset" };
  }
  if (sub === "get") {
    if (argv.length < 2) {
      throw new Error("Missing key for 'clawview config get'");
    }
    const key = normalizeConfigKey(argv[1]);
    if (!key) {
      throw new Error(`Unknown config key: ${argv[1]}`);
    }
    return { action: "get", key };
  }
  if (sub !== "set") {
    throw new Error(`Unknown config subcommand: ${sub}`);
  }

  const changes = {};
  function needValue(i, flag) {
    if (i + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    return argv[i + 1];
  }

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--host": {
        const value = needValue(i, arg).trim();
        if (!value) throw new Error("host cannot be empty");
        changes.host = value;
        i += 1;
        break;
      }
      case "--port": {
        const value = needValue(i, arg);
        const port = Number.parseInt(value, 10);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid port: ${value}`);
        }
        changes.port = port;
        i += 1;
        break;
      }
      case "--state-dir": {
        const value = needValue(i, arg).trim();
        if (!value) throw new Error("state-dir cannot be empty");
        changes.stateDir = value;
        i += 1;
        break;
      }
      case "--history-root": {
        const value = needValue(i, arg).trim();
        if (!value) throw new Error("history-root cannot be empty");
        changes.historyRoot = value;
        i += 1;
        break;
      }
      case "--auto-open": {
        const value = needValue(i, arg);
        changes.autoOpen = parseBooleanLiteral(value, "--auto-open");
        i += 1;
        break;
      }
      case "--open":
        changes.autoOpen = true;
        break;
      case "--no-open":
        changes.autoOpen = false;
        break;
      case "--help":
      case "-h":
        return { action: "help" };
      default:
        throw new Error(`Unknown argument for config set: ${arg}`);
    }
  }

  if (Object.keys(changes).length === 0) {
    throw new Error("No config values provided. Use 'clawview config set --port 9000'.");
  }
  return { action: "set", changes };
}

async function runConfigCommand(argv) {
  const command = parseConfigCommand(argv);
  if (command.action === "help") {
    printConfigHelp();
    return;
  }
  if (command.action === "path") {
    console.log(CONFIG_PATH);
    return;
  }
  if (command.action === "reset") {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log(`[clawview] removed config: ${CONFIG_PATH}`);
    } else {
      console.log(`[clawview] config does not exist: ${CONFIG_PATH}`);
    }
    return;
  }

  const loaded = loadConfig();
  const config = normalizeConfig(loaded.config);

  if (command.action === "show") {
    console.log(JSON.stringify({ configPath: CONFIG_PATH, exists: loaded.exists, ...config }, null, 2));
    return;
  }
  if (command.action === "get") {
    console.log(config[command.key]);
    return;
  }
  if (command.action === "set") {
    const next = normalizeConfig({ ...config, ...command.changes });
    saveConfig(next);
    console.log(JSON.stringify({ configPath: CONFIG_PATH, ...next }, null, 2));
    return;
  }

  throw new Error(`Unsupported config action: ${command.action}`);
}

function parseArgs(argv) {
  const opts = {
    configure: false,
    resetConfig: false,
    printConfig: false,
    silent: false,
    stop: false,
    status: false,
    help: false,
    open: undefined,
    overrides: {},
  };

  function needValue(i, flag) {
    if (i + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    return argv[i + 1];
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--configure":
        opts.configure = true;
        break;
      case "--reset-config":
        opts.resetConfig = true;
        break;
      case "--print-config":
        opts.printConfig = true;
        break;
      case "--silent":
        opts.silent = true;
        break;
      case "--stop":
        opts.stop = true;
        break;
      case "--status":
        opts.status = true;
        break;
      case "--open":
        opts.open = true;
        break;
      case "--no-open":
        opts.open = false;
        break;
      case "--host": {
        const value = needValue(i, arg);
        opts.overrides.host = value;
        i += 1;
        break;
      }
      case "--port":
      case "-p": {
        const value = needValue(i, arg);
        const port = Number.parseInt(value, 10);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid port: ${value}`);
        }
        opts.overrides.port = port;
        i += 1;
        break;
      }
      case "--state-dir": {
        const value = needValue(i, arg);
        opts.overrides.stateDir = value;
        i += 1;
        break;
      }
      case "--history-root": {
        const value = needValue(i, arg);
        opts.overrides.historyRoot = value;
        i += 1;
        break;
      }
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function pickPython() {
  const candidates = [];
  if (process.env.CLAWVIEW_PYTHON && process.env.CLAWVIEW_PYTHON.trim()) {
    candidates.push(process.env.CLAWVIEW_PYTHON.trim());
  }
  candidates.push("python3", "python");

  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
      if (result.status === 0) return cmd;
    } catch (_error) {
      // Ignore and try next candidate.
    }
  }
  return null;
}

function buildPythonArgs(config, autoOpen) {
  const args = [
    APP_PATH,
    "--host",
    config.host,
    "--port",
    String(config.port),
    "--state-dir",
    resolveUserPath(config.stateDir),
    "--history-root",
    resolveUserPath(config.historyRoot),
  ];
  if (autoOpen) {
    args.push("--open");
  }
  return args;
}

function openBrowser(url) {
  if (process.env.CLAWVIEW_NO_BROWSER === "1") return;

  let cmd;
  let args;
  if (process.platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (process.platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch (_error) {
    // Browser open is best-effort in CLI wrapper.
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function readPidFile() {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) ? pid : null;
  } catch (_error) {
    return null;
  }
}

function clearPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch (_error) {
    // ignore
  }
}

function checkHealth(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve(true);
      } else {
        resolve(false);
      }
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, waitMs = 10000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await checkHealth(url, 800)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function startForeground(python, pythonArgs) {
  const child = spawn(python, pythonArgs, { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code == null ? 1 : code);
  });
}

async function startSilent(python, pythonArgs, url, shouldOpen) {
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const currentPid = readPidFile();
  if (currentPid && isPidAlive(currentPid)) {
    console.log(`[clawview] already running (pid: ${currentPid})`);
    if (shouldOpen) openBrowser(url);
    return;
  }
  clearPidFile();

  if (await checkHealth(url, 800)) {
    console.log(`[clawview] already reachable: ${url}`);
    if (shouldOpen) openBrowser(url);
    return;
  }

  const outFd = fs.openSync(LOG_FILE, "a");
  const child = spawn(python, pythonArgs, {
    detached: true,
    stdio: ["ignore", outFd, outFd],
  });
  child.unref();
  fs.writeFileSync(PID_FILE, `${child.pid}\n`, "utf8");

  const ready = await waitForServer(url, 10000);
  if (!ready || !isPidAlive(child.pid)) {
    clearPidFile();
    console.error(`[clawview] failed to confirm startup, check log: ${LOG_FILE}`);
    return;
  }

  console.log(`[clawview] started in background (pid: ${child.pid})`);
  console.log(`[clawview] url: ${url}`);
  if (shouldOpen) openBrowser(url);
}

async function stopSilentProcess() {
  const pid = readPidFile();
  if (!pid) {
    console.log("[clawview] no background pid file found");
    return;
  }
  if (!isPidAlive(pid)) {
    clearPidFile();
    console.log("[clawview] stale pid file removed");
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    console.error(`[clawview] failed to stop process ${pid}: ${error.message}`);
    return;
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      clearPidFile();
      console.log(`[clawview] stopped process ${pid}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.error(`[clawview] process ${pid} still running`);
}

async function showStatus(config) {
  const url = `http://${config.host}:${config.port}`;
  const alive = await checkHealth(url, 1200);
  if (alive) {
    console.log(`[clawview] running: ${url}`);
  } else {
    console.log(`[clawview] not reachable: ${url}`);
  }

  const pid = readPidFile();
  if (pid) {
    console.log(`[clawview] pid file: ${pid} (${isPidAlive(pid) ? "alive" : "stale"})`);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "config") {
    try {
      await runConfigCommand(rawArgs.slice(1));
      return;
    } catch (error) {
      console.error(`[clawview] ${error.message}`);
      console.error("[clawview] use 'clawview config --help' for usage");
      process.exit(1);
    }
  }

  let opts;
  try {
    opts = parseArgs(rawArgs);
  } catch (error) {
    console.error(`[clawview] ${error.message}`);
    console.error("[clawview] use --help for usage");
    process.exit(1);
  }

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.resetConfig) {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log(`[clawview] removed config: ${CONFIG_PATH}`);
    } else {
      console.log(`[clawview] config does not exist: ${CONFIG_PATH}`);
    }
    if (
      !opts.configure &&
      !opts.printConfig &&
      !opts.status &&
      !opts.stop &&
      !opts.silent &&
      Object.keys(opts.overrides).length === 0 &&
      opts.open === undefined
    ) {
      return;
    }
  }

  const loaded = loadConfig();
  let config = normalizeConfig({ ...loaded.config, ...opts.overrides });

  if (opts.configure || (!loaded.exists && process.stdin.isTTY && !opts.silent)) {
    if (!loaded.exists) {
      console.log(`[clawview] no config found, starting setup wizard (${CONFIG_PATH})`);
      console.log("[clawview] press Enter to use defaults");
    }
    config = await runConfigureWizard(config);
    saveConfig(config);
    console.log(`[clawview] config saved: ${CONFIG_PATH}`);
  }

  if (opts.printConfig) {
    console.log(JSON.stringify({ configPath: CONFIG_PATH, ...config }, null, 2));
    if (!opts.status && !opts.stop && !opts.silent) {
      return;
    }
  }

  if (opts.stop) {
    await stopSilentProcess();
    return;
  }

  if (opts.status) {
    await showStatus(config);
    return;
  }

  const python = pickPython();
  if (!python) {
    console.error(
      "[clawview] python runtime not found. Install python3 or set CLAWVIEW_PYTHON=/path/to/python"
    );
    process.exit(1);
  }

  const shouldOpen = opts.open === undefined ? config.autoOpen : opts.open;
  const url = `http://${config.host}:${config.port}`;
  const pythonArgs = buildPythonArgs(config, opts.silent ? false : shouldOpen);

  if (opts.silent) {
    await startSilent(python, pythonArgs, url, shouldOpen);
    return;
  }

  console.log(`[clawview] state dir: ${resolveUserPath(config.stateDir)}`);
  console.log(`[clawview] history  : ${resolveUserPath(config.historyRoot)}`);
  console.log(`[clawview] url      : ${url}`);
  await startForeground(python, pythonArgs);
}

main().catch((error) => {
  console.error(`[clawview] unexpected error: ${error.message}`);
  process.exit(1);
});
