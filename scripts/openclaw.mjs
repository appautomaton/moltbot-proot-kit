import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function normalizeDevFlag(args) {
  const devIndex = args.indexOf('--dev');
  if (devIndex <= 0) return args;
  return ['--dev', ...args.slice(0, devIndex), ...args.slice(devIndex + 1)];
}

const args = normalizeDevFlag(process.argv.slice(2));

// Load config/.env for API keys and secrets
const envFile = path.join(__dirname, '..', 'config', '.env');
loadEnvFile(envFile);

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
