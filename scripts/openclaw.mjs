import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const ENV_FILE_PATH = path.join(REPO_ROOT, 'config', '.env');
const GATEWAY_COMMAND = 'gateway';
const WRAPPER_GATEWAY_RESTART_COMMAND = 'wrapper:gateway:restart';
const WRAPPER_RESTART_SIGNAL = 'SIGUSR2';
const WRAPPER_PID_DIR = path.join(REPO_ROOT, 'bots', 'run');
const CONFIG_TOUCH_DEBOUNCE_MS = 120;
const ENV_RESTART_DEBOUNCE_MS = 250;
const CHILD_STOP_TIMEOUT_MS = 5000;
const WRAPPER_EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
};
const REPO_PATH_ENV_KEYS = [
  'OPENCLAW_STATE_DIR',
  'CLAWDBOT_STATE_DIR',
  'OPENCLAW_CONFIG_PATH',
  'CLAWDBOT_CONFIG_PATH',
  'AGENT_WORKSPACE',
  'XDG_CONFIG_HOME',
];

function noop() {}

export function parseEnvFileContent(content) {
  const parsed = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key) continue;
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) {
      parsed[key] = value;
    }
  }
  return parsed;
}

function readEnvFileValues(envPath) {
  try {
    return parseEnvFileContent(fs.readFileSync(envPath, 'utf8'));
  } catch {
    return {};
  }
}

export function hasNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveUserPathFromRepoRoot(input, repoRoot = REPO_ROOT) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return input;

  if (trimmed.startsWith('~')) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  return path.resolve(repoRoot, trimmed);
}

export function normalizeRepoRelativePathEnvVarsInPlace(
  env,
  keys = REPO_PATH_ENV_KEYS,
  repoRoot = REPO_ROOT,
) {
  for (const key of keys) {
    const raw = env[key];
    if (!hasNonEmpty(raw)) continue;
    env[key] = resolveUserPathFromRepoRoot(raw, repoRoot);
  }
  return env;
}

export function applyGatewayTokenAliasesInPlace(env) {
  if (!hasNonEmpty(env.OPENCLAW_GATEWAY_TOKEN) && hasNonEmpty(env.GATEWAY_AUTH_TOKEN)) {
    env.OPENCLAW_GATEWAY_TOKEN = env.GATEWAY_AUTH_TOKEN;
  }
  if (!hasNonEmpty(env.GATEWAY_AUTH_TOKEN) && hasNonEmpty(env.OPENCLAW_GATEWAY_TOKEN)) {
    env.GATEWAY_AUTH_TOKEN = env.OPENCLAW_GATEWAY_TOKEN;
  }
  return env;
}

export function buildChildEnv({
  baseEnv,
  envPath = ENV_FILE_PATH,
  repoRoot = REPO_ROOT,
  forceNoRespawn = false,
}) {
  const env = { ...baseEnv };
  const envFromFile = readEnvFileValues(envPath);

  for (const [key, value] of Object.entries(envFromFile)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  normalizeRepoRelativePathEnvVarsInPlace(env, REPO_PATH_ENV_KEYS, repoRoot);
  applyGatewayTokenAliasesInPlace(env);

  if (forceNoRespawn) {
    // The wrapper supervises fresh child replacement itself. Keep child restarts
    // in-process so the wrapper never loses control to a detached respawn.
    env.OPENCLAW_NO_RESPAWN = '1';
  }

  return env;
}

export function buildGatewayChildEnv(params) {
  return buildChildEnv({ ...params, forceNoRespawn: true });
}

function findFlagValue(args, flagName) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flagName) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
  }
  return undefined;
}

function sanitizeInstanceIdSegment(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'default';
}

export function resolveWrapperGatewayInstanceId(args) {
  const explicitProfile = findFlagValue(args, '--profile');
  if (hasNonEmpty(explicitProfile)) {
    return `profile-${sanitizeInstanceIdSegment(explicitProfile)}`;
  }
  if (args.includes('--dev')) {
    return 'dev';
  }
  return 'prod';
}

export function resolveWrapperGatewayPidPath(args, repoRoot = REPO_ROOT) {
  const instanceId = resolveWrapperGatewayInstanceId(args);
  return path.join(repoRoot, 'bots', 'run', `openclaw-wrapper-${instanceId}.pid`);
}

export function normalizeDevFlag(args) {
  const devIndex = args.indexOf('--dev');
  if (devIndex <= 0) return args;
  return ['--dev', ...args.slice(0, devIndex), ...args.slice(devIndex + 1)];
}

export function resolvePrimaryCommand(args) {
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      return arg;
    }
  }
  return '';
}

function touchFileMtime(filePath) {
  const now = new Date();
  fs.utimesSync(filePath, now, now);
}

function writeWrapperPidFile(pidFilePath, pid = process.pid) {
  fs.mkdirSync(path.dirname(pidFilePath), { recursive: true });
  fs.writeFileSync(pidFilePath, `${pid}\n`, 'utf8');
}

function readWrapperPidFile(pidFilePath) {
  const raw = fs.readFileSync(pidFilePath, 'utf8').trim();
  const pid = Number.parseInt(raw, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid wrapper pid file: ${pidFilePath}`);
  }
  return pid;
}

function removeWrapperPidFileIfOwned(pidFilePath, pid = process.pid) {
  try {
    const currentOwner = readWrapperPidFile(pidFilePath);
    if (currentOwner !== pid) {
      return;
    }
  } catch {
    return;
  }
  try {
    fs.unlinkSync(pidFilePath);
  } catch {
    // best-effort
  }
}

export function resolveConfigPathFromEnv(env, repoRoot = REPO_ROOT) {
  const configPathRaw =
    env.OPENCLAW_CONFIG_PATH || env.CLAWDBOT_CONFIG_PATH || 'config/openclaw.json';
  return resolveUserPathFromRepoRoot(configPathRaw, repoRoot);
}

function startConfigIncludeTouchBridge({ args, env, repoRoot = REPO_ROOT, isRestartPending }) {
  if (env.OPENCLAW_INCLUDE_TOUCH_BRIDGE === '0') {
    return noop;
  }

  if (resolvePrimaryCommand(args) !== GATEWAY_COMMAND) {
    return noop;
  }

  const configPath = resolveConfigPathFromEnv(env, repoRoot);
  const includeDir = path.join(path.dirname(configPath), 'openclaw.d');
  if (!fs.existsSync(configPath) || !fs.existsSync(includeDir)) {
    return noop;
  }

  let debounce = null;
  const scheduleTouch = () => {
    if (typeof isRestartPending === 'function' && isRestartPending()) {
      return;
    }
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (typeof isRestartPending === 'function' && isRestartPending()) {
        return;
      }
      try {
        touchFileMtime(configPath);
      } catch {
        // Best-effort bridge: keep gateway running even if touch fails.
      }
    }, CONFIG_TOUCH_DEBOUNCE_MS);
  };

  let watcher = null;
  try {
    watcher = fs.watch(includeDir, (eventType, fileName) => {
      const name = typeof fileName === 'string' ? fileName : '';
      if (name && !name.endsWith('.json') && !name.endsWith('.json5')) {
        return;
      }
      if (eventType === 'rename' || eventType === 'change') {
        scheduleTouch();
      }
    });
  } catch {
    return noop;
  }

  return () => {
    if (debounce) clearTimeout(debounce);
    debounce = null;
    try {
      watcher?.close();
    } catch {
      // best-effort
    }
  };
}

function startEnvFileWatcher({ envPath = ENV_FILE_PATH, onChange }) {
  const envDir = path.dirname(envPath);
  const envBaseName = path.basename(envPath);
  if (!fs.existsSync(envDir)) {
    return noop;
  }

  let fileWatcher = null;
  const closeFileWatcher = () => {
    try {
      fileWatcher?.close();
    } catch {
      // best-effort
    }
    fileWatcher = null;
  };
  const openFileWatcher = () => {
    closeFileWatcher();
    if (!fs.existsSync(envPath)) {
      return;
    }
    try {
      fileWatcher = fs.watch(envPath, (eventType) => {
        if (eventType === 'rename' || eventType === 'change') {
          onChange();
        }
      });
    } catch {
      // best-effort
    }
  };

  openFileWatcher();

  let dirWatcher = null;
  try {
    dirWatcher = fs.watch(envDir, (eventType, fileName) => {
      const name = typeof fileName === 'string' ? fileName : '';
      if (name && name !== envBaseName) {
        return;
      }
      if (eventType === 'rename' || eventType === 'change') {
        openFileWatcher();
        onChange();
      }
    });
  } catch {
    closeFileWatcher();
    return noop;
  }

  return () => {
    closeFileWatcher();
    try {
      dirWatcher?.close();
    } catch {
      // best-effort
    }
  };
}

function spawnOpenclawChild(args, env) {
  return spawn('pnpm', ['--dir', 'openclaw', 'openclaw', ...args], {
    stdio: 'inherit',
    env,
  });
}

function exitFromChild(code, signal) {
  if (typeof code === 'number') process.exit(code);
  if (signal) process.exit(128);
  process.exit(1);
}

function runOneShotCommand(args) {
  const child = spawnOpenclawChild(
    args,
    buildChildEnv({
      baseEnv: process.env,
      envPath: ENV_FILE_PATH,
    }),
  );

  child.on('exit', (code, signal) => {
    exitFromChild(code, signal);
  });

  child.on('error', (err) => {
    console.error(err?.message ?? String(err));
    process.exit(1);
  });
}

function runWrapperGatewayRestart(args) {
  const pidFilePath = resolveWrapperGatewayPidPath(args);
  let pid;
  try {
    pid = readWrapperPidFile(pidFilePath);
  } catch {
    console.error(`openclaw wrapper: gateway wrapper pid file not found at ${pidFilePath}`);
    process.exit(1);
  }

  try {
    process.kill(pid, WRAPPER_RESTART_SIGNAL);
  } catch (err) {
    if (err?.code === 'ESRCH') {
      removeWrapperPidFileIfOwned(pidFilePath, pid);
      console.error(
        `openclaw wrapper: stale gateway wrapper pid file removed (${pidFilePath}); wrapper is not running`,
      );
      process.exit(1);
    }
    console.error(
      `openclaw wrapper: failed to signal running wrapper pid ${pid}: ${err?.message ?? String(err)}`,
    );
    process.exit(1);
  }

  console.error(`openclaw wrapper: restart signal sent to wrapper pid ${pid}`);
}

function runGatewaySupervisor(args) {
  const baseEnv = { ...process.env };
  const pidFilePath = resolveWrapperGatewayPidPath(args);
  let child = null;
  let stopConfigIncludeTouchBridge = noop;
  let stopEnvFileWatcher = noop;
  let envRestartDebounce = null;
  let childStopTimer = null;
  let pendingRespawn = false;
  let wrapperStopping = false;
  let shutdownSignal = null;

  writeWrapperPidFile(pidFilePath);
  process.on('exit', () => removeWrapperPidFileIfOwned(pidFilePath));

  const clearChildStopTimer = () => {
    if (childStopTimer) {
      clearTimeout(childStopTimer);
      childStopTimer = null;
    }
  };
  const clearEnvRestartDebounce = () => {
    if (envRestartDebounce) {
      clearTimeout(envRestartDebounce);
      envRestartDebounce = null;
    }
  };
  const stopActiveConfigBridge = () => {
    stopConfigIncludeTouchBridge();
    stopConfigIncludeTouchBridge = noop;
  };
  const stopAllWatchers = () => {
    stopActiveConfigBridge();
    stopEnvFileWatcher();
    stopEnvFileWatcher = noop;
  };
  const isRestartPending = () => pendingRespawn || envRestartDebounce !== null;

  const attachConfigBridge = (childEnv) => {
    stopActiveConfigBridge();
    stopConfigIncludeTouchBridge = startConfigIncludeTouchBridge({
      args,
      env: childEnv,
      isRestartPending,
    });
  };

  const spawnChild = () => {
    const childEnv = buildGatewayChildEnv({
      baseEnv,
      envPath: ENV_FILE_PATH,
    });

    attachConfigBridge(childEnv);
    child = spawnOpenclawChild(args, childEnv);

    child.on('exit', (code, signal) => {
      child = null;
      clearChildStopTimer();
      stopActiveConfigBridge();

      if (pendingRespawn && !wrapperStopping) {
        pendingRespawn = false;
        spawnChild();
        return;
      }

      if (wrapperStopping) {
        const exitCode = shutdownSignal ? WRAPPER_EXIT_CODES[shutdownSignal] : null;
        if (typeof exitCode === 'number') {
          process.exit(exitCode);
        }
      }

      stopAllWatchers();
      exitFromChild(code, signal);
    });

    child.on('error', (err) => {
      clearChildStopTimer();
      stopAllWatchers();
      console.error(err?.message ?? String(err));
      process.exit(1);
    });
  };

  const requestGatewayRespawn = (reason) => {
    if (wrapperStopping) {
      return;
    }
    if (pendingRespawn) {
      return;
    }

    pendingRespawn = true;
    if (!child) {
      pendingRespawn = false;
      spawnChild();
      return;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    console.error(`openclaw wrapper: ${reason}; restarting gateway`);
    clearChildStopTimer();
    childStopTimer = setTimeout(() => {
      try {
        child?.kill('SIGKILL');
      } catch {
        // best-effort
      }
    }, CHILD_STOP_TIMEOUT_MS);

    try {
      child.kill('SIGTERM');
    } catch {
      clearChildStopTimer();
      pendingRespawn = false;
      stopAllWatchers();
      throw new Error(`Failed to stop gateway child for ${reason}.`);
    }
  };

  const scheduleEnvRestart = () => {
    if (wrapperStopping) {
      return;
    }
    clearEnvRestartDebounce();
    envRestartDebounce = setTimeout(() => {
      envRestartDebounce = null;
      requestGatewayRespawn('config/.env changed');
    }, ENV_RESTART_DEBOUNCE_MS);
  };

  const beginWrapperShutdown = (signal) => {
    if (wrapperStopping) {
      return;
    }
    wrapperStopping = true;
    shutdownSignal = signal;
    pendingRespawn = false;
    clearEnvRestartDebounce();
    stopAllWatchers();

    if (!child) {
      process.exit(WRAPPER_EXIT_CODES[signal] ?? 1);
      return;
    }

    clearChildStopTimer();
    childStopTimer = setTimeout(() => {
      try {
        child?.kill('SIGKILL');
      } catch {
        // best-effort
      }
      process.exit(WRAPPER_EXIT_CODES[signal] ?? 1);
    }, CHILD_STOP_TIMEOUT_MS);

    try {
      child.kill(signal);
    } catch {
      clearChildStopTimer();
      process.exit(WRAPPER_EXIT_CODES[signal] ?? 1);
    }
  };

  process.on('SIGINT', () => beginWrapperShutdown('SIGINT'));
  process.on('SIGTERM', () => beginWrapperShutdown('SIGTERM'));
  process.on(WRAPPER_RESTART_SIGNAL, () => requestGatewayRespawn('manual restart requested'));

  stopEnvFileWatcher = startEnvFileWatcher({
    envPath: ENV_FILE_PATH,
    onChange: scheduleEnvRestart,
  });
  spawnChild();
}

function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === WRAPPER_GATEWAY_RESTART_COMMAND) {
    runWrapperGatewayRestart(rawArgs.slice(1));
    return;
  }

  const args = normalizeDevFlag(rawArgs);
  if (resolvePrimaryCommand(args) === GATEWAY_COMMAND) {
    runGatewaySupervisor(args);
    return;
  }
  runOneShotCommand(args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
