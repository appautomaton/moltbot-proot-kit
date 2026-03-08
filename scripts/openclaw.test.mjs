import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildChildEnv,
  buildGatewayChildEnv,
  parseEnvFileContent,
  resolveWrapperGatewayInstanceId,
  resolveWrapperGatewayPidPath,
} from './openclaw.mjs';

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-wrapper-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

test('parseEnvFileContent parses simple dotenv syntax', () => {
  const parsed = parseEnvFileContent(`
# comment
FOO=bar
BAR="quoted value"
BAZ='single quoted'
EMPTY=
`);

  assert.deepEqual(parsed, {
    FOO: 'bar',
    BAR: 'quoted value',
    BAZ: 'single quoted',
  });
});

test('buildChildEnv rebuilds from base env so removed dotenv keys do not linger', (t) => {
  const repoRoot = makeTempDir(t);
  const envPath = path.join(repoRoot, '.env');

  fs.writeFileSync(envPath, 'FROM_FILE=first\n', 'utf8');
  const first = buildChildEnv({
    baseEnv: {},
    envPath,
    repoRoot,
  });
  assert.equal(first.FROM_FILE, 'first');

  fs.writeFileSync(envPath, 'OTHER=value\n', 'utf8');
  const second = buildChildEnv({
    baseEnv: {},
    envPath,
    repoRoot,
  });
  assert.equal(second.FROM_FILE, undefined);
  assert.equal(second.OTHER, 'value');
});

test('buildChildEnv preserves base env precedence over config/.env', (t) => {
  const repoRoot = makeTempDir(t);
  const envPath = path.join(repoRoot, '.env');

  fs.writeFileSync(envPath, 'FROM_FILE=file-value\n', 'utf8');
  const env = buildChildEnv({
    baseEnv: { FROM_FILE: 'shell-value' },
    envPath,
    repoRoot,
  });

  assert.equal(env.FROM_FILE, 'shell-value');
});

test('buildChildEnv normalizes repo-relative path env vars', (t) => {
  const repoRoot = makeTempDir(t);
  const envPath = path.join(repoRoot, '.env');

  fs.writeFileSync(
    envPath,
    [
      'OPENCLAW_STATE_DIR=bots',
      'OPENCLAW_CONFIG_PATH=config/openclaw.json',
      'XDG_CONFIG_HOME=oauth',
    ].join('\n'),
    'utf8',
  );

  const env = buildChildEnv({
    baseEnv: {},
    envPath,
    repoRoot,
  });

  assert.equal(env.OPENCLAW_STATE_DIR, path.resolve(repoRoot, 'bots'));
  assert.equal(env.OPENCLAW_CONFIG_PATH, path.resolve(repoRoot, 'config/openclaw.json'));
  assert.equal(env.XDG_CONFIG_HOME, path.resolve(repoRoot, 'oauth'));
});

test('buildChildEnv applies gateway token compatibility aliases', (t) => {
  const repoRoot = makeTempDir(t);
  const envPath = path.join(repoRoot, '.env');

  fs.writeFileSync(envPath, 'GATEWAY_AUTH_TOKEN=wrapper-token\n', 'utf8');
  const env = buildChildEnv({
    baseEnv: {},
    envPath,
    repoRoot,
  });

  assert.equal(env.GATEWAY_AUTH_TOKEN, 'wrapper-token');
  assert.equal(env.OPENCLAW_GATEWAY_TOKEN, 'wrapper-token');
});

test('buildGatewayChildEnv forces in-process child restarts for wrapper-managed gateway runs', (t) => {
  const repoRoot = makeTempDir(t);
  const envPath = path.join(repoRoot, '.env');

  fs.writeFileSync(envPath, '', 'utf8');
  const env = buildGatewayChildEnv({
    baseEnv: { OPENCLAW_NO_RESPAWN: '0' },
    envPath,
    repoRoot,
  });

  assert.equal(env.OPENCLAW_NO_RESPAWN, '1');
});

test('resolveWrapperGatewayInstanceId distinguishes prod, dev, and named profiles', () => {
  assert.equal(resolveWrapperGatewayInstanceId([]), 'prod');
  assert.equal(resolveWrapperGatewayInstanceId(['--dev']), 'dev');
  assert.equal(resolveWrapperGatewayInstanceId(['--profile', 'Team Alpha']), 'profile-team-alpha');
  assert.equal(resolveWrapperGatewayInstanceId(['--profile=Blue/Green']), 'profile-blue-green');
});

test('resolveWrapperGatewayPidPath is profile-aware and repo-local', (t) => {
  const repoRoot = makeTempDir(t);

  assert.equal(
    resolveWrapperGatewayPidPath([], repoRoot),
    path.join(repoRoot, 'bots', 'run', 'openclaw-wrapper-prod.pid'),
  );
  assert.equal(
    resolveWrapperGatewayPidPath(['--dev'], repoRoot),
    path.join(repoRoot, 'bots', 'run', 'openclaw-wrapper-dev.pid'),
  );
  assert.equal(
    resolveWrapperGatewayPidPath(['--profile', 'qa'], repoRoot),
    path.join(repoRoot, 'bots', 'run', 'openclaw-wrapper-profile-qa.pid'),
  );
});
