import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_SOURCE_CONFIG_PATH = path.join(REPO_ROOT, 'config', 'openclaw', 'openclaw.json5');
const MAX_INCLUDE_DEPTH = 10;
const RUNTIME_CONFIG_DIR = '.runtime';
const RUNTIME_CONFIG_FILENAME = 'openclaw.runtime.json5';
const RUNTIME_META_FILENAME = 'openclaw.runtime.meta.json';

function loadJson5() {
  try {
    const requireFromOpenClaw = createRequire(path.join(REPO_ROOT, 'openclaw', 'package.json'));
    return requireFromOpenClaw('json5');
  } catch (error) {
    throw new Error(
      `Unable to load JSON5 from openclaw/. Run "pnpm openclaw:install" first. ${error?.message ?? String(error)}`,
    );
  }
}

const JSON5 = loadJson5();

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      result[key] = hasOwn(result, key) ? deepMerge(result[key], source[key]) : source[key];
    }
    return result;
  }

  return source;
}

function normalizePathForCompare(input) {
  return path.normalize(input);
}

function safeRealpath(input) {
  try {
    return fs.realpathSync(input);
  } catch {
    return input;
  }
}

function isPathInside(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hashContent(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function resolveIncludePath(includePath, basePath, rootDir, rootRealDir) {
  const configDir = path.dirname(basePath);
  const resolved = path.isAbsolute(includePath) ? includePath : path.resolve(configDir, includePath);
  const normalized = normalizePathForCompare(resolved);

  if (!isPathInside(rootDir, normalized)) {
    throw new Error(`Include path escapes config directory: ${includePath} (root: ${rootDir})`);
  }

  try {
    const real = normalizePathForCompare(fs.realpathSync(normalized));
    if (!isPathInside(rootRealDir, real)) {
      throw new Error(
        `Include path resolves outside config directory (symlink): ${includePath} (root: ${rootDir})`,
      );
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  return normalized;
}

function resolveIncludedConfig(includePath, state) {
  const resolvedPath = resolveIncludePath(
    includePath,
    state.basePath,
    state.rootDir,
    state.rootRealDir,
  );

  if (state.stack.includes(resolvedPath)) {
    throw new Error(`Circular include detected: ${[...state.stack, resolvedPath].join(' -> ')}`);
  }

  if (state.stack.length >= MAX_INCLUDE_DEPTH) {
    throw new Error(`Maximum include depth (${MAX_INCLUDE_DEPTH}) exceeded at: ${includePath}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to read include file: ${includePath} (resolved: ${resolvedPath}) - ${error?.message ?? String(error)}`,
    );
  }

  let parsed;
  try {
    parsed = JSON5.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse include file: ${includePath} (resolved: ${resolvedPath}) - ${error?.message ?? String(error)}`,
    );
  }

  return resolveConfigNode(parsed, {
    ...state,
    basePath: resolvedPath,
    stack: [...state.stack, resolvedPath],
  });
}

function resolveIncludeValue(includeValue, state) {
  if (typeof includeValue === 'string') {
    return resolveIncludedConfig(includeValue, state);
  }

  if (Array.isArray(includeValue)) {
    return includeValue.reduce((merged, item) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid $include array item: expected string, got ${typeof item}`);
      }
      return deepMerge(merged, resolveIncludedConfig(item, state));
    }, {});
  }

  throw new Error(`Invalid $include value: expected string or array of strings, got ${typeof includeValue}`);
}

function resolveConfigNode(node, state) {
  if (Array.isArray(node)) {
    return node.map((item) => resolveConfigNode(item, state));
  }

  if (!isPlainObject(node)) {
    return node;
  }

  if (!hasOwn(node, '$include')) {
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = resolveConfigNode(value, state);
    }
    return result;
  }

  const included = resolveIncludeValue(node.$include, state);
  const siblingKeys = Object.keys(node).filter((key) => key !== '$include');
  if (siblingKeys.length === 0) {
    return included;
  }

  if (!isPlainObject(included)) {
    throw new Error('Sibling keys require included content to be an object');
  }

  const rest = {};
  for (const key of siblingKeys) {
    rest[key] = resolveConfigNode(node[key], state);
  }
  return deepMerge(included, rest);
}

function renderSourceConfig(sourceConfigPath) {
  const normalizedSourcePath = normalizePathForCompare(path.resolve(sourceConfigPath));
  const rootDir = normalizePathForCompare(path.dirname(normalizedSourcePath));
  const rootRealDir = normalizePathForCompare(safeRealpath(rootDir));
  const raw = fs.readFileSync(normalizedSourcePath, 'utf8');
  const parsed = JSON5.parse(raw);
  return resolveConfigNode(parsed, {
    basePath: normalizedSourcePath,
    rootDir,
    rootRealDir,
    stack: [normalizedSourcePath],
  });
}

function readRuntimeMeta(metaPath) {
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

export function prepareRuntimeConfig({ sourceConfigPath = DEFAULT_SOURCE_CONFIG_PATH, stateDir }) {
  if (!stateDir) {
    throw new Error('stateDir is required');
  }

  const renderedConfig = renderSourceConfig(sourceConfigPath);
  const renderedJson = JSON.stringify(renderedConfig, null, 2).trimEnd().concat('\n');
  const sourceHash = hashContent(renderedJson);
  const runtimeDir = path.join(path.resolve(stateDir), RUNTIME_CONFIG_DIR);
  const runtimeConfigPath = path.join(runtimeDir, RUNTIME_CONFIG_FILENAME);
  const runtimeMetaPath = path.join(runtimeDir, RUNTIME_META_FILENAME);
  const runtimeMeta = readRuntimeMeta(runtimeMetaPath);

  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });

  const shouldWriteRuntimeConfig =
    !fs.existsSync(runtimeConfigPath) || runtimeMeta?.sourceHash !== sourceHash;

  if (shouldWriteRuntimeConfig) {
    fs.writeFileSync(runtimeConfigPath, renderedJson, { mode: 0o600 });
    fs.writeFileSync(
      runtimeMetaPath,
      JSON.stringify(
        {
          sourceConfigPath: path.resolve(sourceConfigPath),
          sourceHash,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ).concat('\n'),
      { mode: 0o600 },
    );
  }

  return {
    runtimeConfigPath,
    runtimeMetaPath,
    sourceHash,
    wroteRuntimeConfig: shouldWriteRuntimeConfig,
  };
}
