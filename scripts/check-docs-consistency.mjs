import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function addCheck(description, passed, detail) {
  checks.push({ description, passed, detail });
}

function includes(file, needle) {
  return read(file).includes(needle);
}

function doesNotInclude(file, needle) {
  return !read(file).includes(needle);
}

addCheck(
  'config/.env.template pins OPENCLAW_STATE_DIR to bots',
  includes('config/.env.template', 'OPENCLAW_STATE_DIR=bots'),
);
addCheck(
  'config/.env.template points at modular repo config',
  includes('config/.env.template', 'OPENCLAW_CONFIG_PATH=config/openclaw/openclaw.json5'),
);
addCheck(
  'wrapper defaults missing OPENCLAW_STATE_DIR to repo-local bots',
  includes('scripts/openclaw.mjs', "process.env.OPENCLAW_STATE_DIR = resolveUserPathFromRepoRoot('bots');"),
);
addCheck(
  'wrapper renders runtime config under the state dir',
  includes('scripts/openclaw-config-runtime.mjs', "const RUNTIME_CONFIG_DIR = '.runtime';") &&
    includes('scripts/openclaw-config-runtime.mjs', "const RUNTIME_CONFIG_FILENAME = 'openclaw.runtime.json5';"),
);
addCheck(
  'browser sidecar defaults to repo-local state, not home OpenClaw state',
  includes('scripts/browser-service.sh', 'openclaw_state_dir="$(resolve_repo_path "${OPENCLAW_STATE_DIR:-bots}")"') &&
    includes('scripts/browser-service.sh', 'profile="${BROWSER_PROFILE:-openclaw}"') &&
    doesNotInclude('scripts/browser-service.sh', '$HOME/.openclaw') &&
    includes('scripts/browser-service.sh', 'OPENCLAW_MONOREPO_ALLOW_EXTERNAL_PATHS'),
);
addCheck(
  'wrapper rejects external OpenClaw path env vars by default',
  includes('scripts/openclaw.mjs', 'OPENCLAW_MONOREPO_ALLOW_EXTERNAL_PATHS') &&
    includes('scripts/openclaw.mjs', 'assertRepoContainedPathEnvVars'),
);
addCheck(
  'tracked compatibility config includes the modular repo config',
  includes('bots/openclaw.json', '$include: "../config/openclaw/openclaw.json5"'),
);
addCheck(
  'commands docs describe wrapper-defaulted repo-local state',
  includes('docs/COMMANDS.md', 'OPENCLAW_STATE_DIR=bots') &&
    includes('docs/COMMANDS.md', 'defaulted by the wrapper') &&
    includes('docs/COMMANDS.md', '`--dev` and `--profile <name>` flags still inherit') &&
    includes('docs/COMMANDS.md', 'OPENCLAW_MONOREPO_ALLOW_EXTERNAL_PATHS'),
);
addCheck(
  'scripts docs describe repo-local browser state',
  includes('scripts/README.md', '$OPENCLAW_STATE_DIR/browser/') &&
    includes('scripts/README.md', 'bots/browser/'),
);
addCheck(
  'scripts docs describe repo-contained profile flags',
  includes('scripts/README.md', '`--dev` and `--profile <name>` still inherit'),
);
addCheck(
  'proot docs describe repo-local browser profile',
  includes('docs/proot-setup.md', 'bots/browser/openclaw/user-data'),
);

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('docs consistency checks failed:');
  for (const check of failed) {
    console.error(`- ${check.description}${check.detail ? `: ${check.detail}` : ''}`);
  }
  process.exit(1);
}

console.log(`docs consistency checks passed (${checks.length})`);
