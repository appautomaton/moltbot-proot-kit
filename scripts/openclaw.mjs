import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

/**
 * Load .env file and inject into process.env (without overriding existing values).
 */
function loadEnvFile(envPath) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already defined and value is non-empty
      if (!process.env[key] && value.length > 0) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file doesn't exist or can't be read - that's fine
  }
}

function hasNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveUserPathFromRepoRoot(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return input;

  // Expand "~" the same way OpenClaw does.
  if (trimmed.startsWith('~')) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  // Treat relative paths as relative to the repo root (not openclaw/).
  return path.resolve(REPO_ROOT, trimmed);
}

function normalizeRepoRelativePathEnvVars(keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (!hasNonEmpty(raw)) continue;
    process.env[key] = resolveUserPathFromRepoRoot(raw);
  }
}

function normalizeDevFlag(args) {
  const devIndex = args.indexOf('--dev');
  if (devIndex <= 0) return args;
  return ['--dev', ...args.slice(0, devIndex), ...args.slice(devIndex + 1)];
}

const args = normalizeDevFlag(process.argv.slice(2));

// Load config/.env for API keys and secrets
const envFile = path.join(__dirname, '..', 'config', '.env');
loadEnvFile(envFile);

// Normalize repo-relative path env vars (so values like "bots" resolve to <repo>/bots).
normalizeRepoRelativePathEnvVars([
  'OPENCLAW_STATE_DIR',
  'CLAWDBOT_STATE_DIR',
  'OPENCLAW_CONFIG_PATH',
  'CLAWDBOT_CONFIG_PATH',
]);

// Compatibility aliases:
// - OpenClaw expects OPENCLAW_GATEWAY_TOKEN (and friends).
// - This platform historically used GATEWAY_AUTH_TOKEN in config/.env and config/openclaw.json.
if (!hasNonEmpty(process.env.OPENCLAW_GATEWAY_TOKEN) && hasNonEmpty(process.env.GATEWAY_AUTH_TOKEN)) {
  process.env.OPENCLAW_GATEWAY_TOKEN = process.env.GATEWAY_AUTH_TOKEN;
}
if (!hasNonEmpty(process.env.GATEWAY_AUTH_TOKEN) && hasNonEmpty(process.env.OPENCLAW_GATEWAY_TOKEN)) {
  process.env.GATEWAY_AUTH_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
}
if (!hasNonEmpty(process.env.OPENCLAW_CONFIG_PATH) && hasNonEmpty(process.env.CLAWDBOT_CONFIG_PATH)) {
  process.env.OPENCLAW_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH;
}
if (!hasNonEmpty(process.env.CLAWDBOT_CONFIG_PATH) && hasNonEmpty(process.env.OPENCLAW_CONFIG_PATH)) {
  process.env.CLAWDBOT_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH;
}

const child = spawn('pnpm', ['--dir', 'openclaw', 'openclaw', ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) process.exit(128);
  process.exit(1);
});

child.on('error', (err) => {
  console.error(err?.message ?? String(err));
  process.exit(1);
});
