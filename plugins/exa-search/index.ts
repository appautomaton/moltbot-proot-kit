import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { jsonResult, readNumberParam, readStringParam } from "openclaw/plugin-sdk";

type SearchType = "auto" | "fast" | "neural" | "deep";
type Category =
  | "company"
  | "research paper"
  | "news"
  | "pdf"
  | "github"
  | "tweet"
  | "personal site"
  | "linkedin profile"
  | "financial report";
type LivecrawlMode = "never" | "fallback" | "preferred" | "always";

type PluginConfig = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  retryBackoffMs?: number;
  retryJitterMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  defaultType?: SearchType;
  defaultNumResults?: number;
  maxNumResults?: number;
  defaultText?: boolean;
  defaultSummary?: boolean;
  defaultHighlights?: boolean;
  defaultModeration?: boolean;
  defaultLivecrawl?: LivecrawlMode;
  resultTextChars?: number;
};

type ResolvedConfig = {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  retryBackoffMs: number;
  retryJitterMs: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  defaultType: SearchType;
  defaultNumResults: number;
  maxNumResults: number;
  defaultText: boolean;
  defaultSummary: boolean;
  defaultHighlights: boolean;
  defaultModeration: boolean;
  defaultLivecrawl?: LivecrawlMode;
  resultTextChars: number;
};

type SearchBody = Record<string, unknown>;

type SearchResponse = {
  requestId?: string;
  costDollars?: number;
  resolvedSearchType?: string;
  searchType?: string;
  autoDate?: string;
  results?: unknown[];
  statuses?: unknown;
  [key: string]: unknown;
};

type ToolPayload = {
  ok: true;
  provider: "exa";
  cache: {
    hit: boolean;
    key: string;
    fetchedAt: string;
  };
  request: {
    body: SearchBody;
    endpoint: string;
  };
  meta: {
    requestId?: string;
    searchType?: string;
    autoDate?: string;
    costDollars?: number;
    statuses?: unknown;
    warnings: string[];
    retriesUsed: number;
  };
  resultCount: number;
  results: Array<Record<string, unknown>>;
};

type CacheEntry = {
  expiresAt: number;
  payload: ToolPayload;
};

const SEARCH_TYPES: SearchType[] = ["auto", "fast", "neural", "deep"];
const CATEGORIES: Category[] = [
  "company",
  "research paper",
  "news",
  "pdf",
  "github",
  "tweet",
  "personal site",
  "linkedin profile",
  "financial report",
];
const LIVECRAWL_MODES: LivecrawlMode[] = ["never", "fallback", "preferred", "always"];

const SEARCH_TYPE_SET = new Set<string>(SEARCH_TYPES);
const CATEGORY_SET = new Set<string>(CATEGORIES);
const LIVECRAWL_SET = new Set<string>(LIVECRAWL_MODES);
const COMPANY_CATEGORY = "company";
const PEOPLE_CATEGORIES = new Set<string>(["linkedin profile", "personal site"]);
const RETRYABLE_STATUS = new Set<number>([408, 425, 429, 500, 502, 503, 504]);

const DEFAULTS: Omit<ResolvedConfig, "apiKey" | "defaultLivecrawl"> = {
  baseUrl: "https://api.exa.ai",
  timeoutMs: 20_000,
  retries: 3,
  retryBackoffMs: 400,
  retryJitterMs: 200,
  cacheTtlMs: 120_000,
  cacheMaxEntries: 256,
  defaultType: "auto",
  defaultNumResults: 10,
  maxNumResults: 25,
  defaultText: true,
  defaultSummary: false,
  defaultHighlights: false,
  defaultModeration: false,
  resultTextChars: 1_400,
};

const MEMORY_CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<ToolPayload>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.trunc(value);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeBaseUrl(raw: unknown): string {
  const base = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULTS.baseUrl;
  return base.replace(/\/+$/, "");
}

function normalizeSearchType(raw: unknown, fallback: SearchType): SearchType {
  if (typeof raw !== "string" || !raw.trim()) {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (!SEARCH_TYPE_SET.has(value)) {
    throw new Error(`type must be one of: ${SEARCH_TYPES.join(", ")}`);
  }
  return value as SearchType;
}

function normalizeCategory(raw: unknown): Category | undefined {
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (!CATEGORY_SET.has(value)) {
    throw new Error(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return value as Category;
}

function normalizeLivecrawl(raw: unknown): LivecrawlMode | undefined {
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (!LIVECRAWL_SET.has(value)) {
    throw new Error(`livecrawl must be one of: ${LIVECRAWL_MODES.join(", ")}`);
  }
  return value as LivecrawlMode;
}

function readBooleanParam(params: Record<string, unknown>, key: string): boolean | undefined {
  const raw = params[key];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(value)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(value)) {
      return false;
    }
  }
  throw new Error(`${key} must be a boolean`);
}

function readStringListParam(params: Record<string, unknown>, key: string): string[] | undefined {
  const raw = params[key];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  let values: string[] = [];
  if (Array.isArray(raw)) {
    values = raw
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  } else if (typeof raw === "string") {
    values = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  } else {
    throw new Error(`${key} must be a string array or comma-separated string`);
  }
  if (values.length === 0) {
    return undefined;
  }
  return Array.from(new Set(values));
}

function readDateParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = readStringParam(params, key);
  if (!value) {
    return undefined;
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new Error(`${key} must be an ISO date or datetime`);
  }
  return value;
}

function normalizeCountryCode(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new Error("userLocation must be a 2-letter country code (ISO-3166 alpha-2)");
  }
  return code;
}

function sanitizeApiKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const value = raw.trim();
  return value || undefined;
}

function readRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.trunc(seconds * 1000);
  }
  const at = Date.parse(value);
  if (Number.isFinite(at)) {
    const delta = at - Date.now();
    if (delta > 0) {
      return Math.trunc(delta);
    }
  }
  return undefined;
}

function shouldRetryStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status) || status >= 500;
}

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  return err.name === "AbortError" || /aborted/i.test(err.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(
  cfg: ResolvedConfig,
  attempt: number,
  retryAfterMs: number | undefined,
): number {
  if (retryAfterMs !== undefined) {
    return Math.max(50, retryAfterMs);
  }
  const exponential = cfg.retryBackoffMs * Math.pow(2, attempt);
  const jitter = cfg.retryJitterMs > 0 ? Math.floor(Math.random() * cfg.retryJitterMs) : 0;
  return Math.max(50, exponential + jitter);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .filter((key) => obj[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

function readConfig(api: OpenClawPluginApi): ResolvedConfig {
  const raw = (isRecord(api.pluginConfig) ? (api.pluginConfig as PluginConfig) : {}) ?? {};
  const defaultType = normalizeSearchType(raw.defaultType, DEFAULTS.defaultType);
  const baseUrl = normalizeBaseUrl(raw.baseUrl);

  const timeoutMs = clampInt(
    readNumberOrDefault(raw.timeoutMs, DEFAULTS.timeoutMs),
    1_000,
    120_000,
  );
  const retries = clampInt(readNumberOrDefault(raw.retries, DEFAULTS.retries), 0, 8);
  const retryBackoffMs = clampInt(
    readNumberOrDefault(raw.retryBackoffMs, DEFAULTS.retryBackoffMs),
    50,
    60_000,
  );
  const retryJitterMs = clampInt(
    readNumberOrDefault(raw.retryJitterMs, DEFAULTS.retryJitterMs),
    0,
    10_000,
  );
  const cacheTtlMs = clampInt(
    readNumberOrDefault(raw.cacheTtlMs, DEFAULTS.cacheTtlMs),
    0,
    3_600_000,
  );
  const cacheMaxEntries = clampInt(
    readNumberOrDefault(raw.cacheMaxEntries, DEFAULTS.cacheMaxEntries),
    0,
    5_000,
  );
  const defaultNumResults = clampInt(
    readNumberOrDefault(raw.defaultNumResults, DEFAULTS.defaultNumResults),
    1,
    100,
  );
  const maxNumResults = clampInt(readNumberOrDefault(raw.maxNumResults, DEFAULTS.maxNumResults), 1, 100);
  const resultTextChars = clampInt(
    readNumberOrDefault(raw.resultTextChars, DEFAULTS.resultTextChars),
    0,
    20_000,
  );

  const cfg: ResolvedConfig = {
    apiKey: sanitizeApiKey(raw.apiKey),
    baseUrl,
    timeoutMs,
    retries,
    retryBackoffMs,
    retryJitterMs,
    cacheTtlMs,
    cacheMaxEntries,
    defaultType,
    defaultNumResults,
    maxNumResults,
    defaultText: readBooleanOrDefault(raw.defaultText, DEFAULTS.defaultText),
    defaultSummary: readBooleanOrDefault(raw.defaultSummary, DEFAULTS.defaultSummary),
    defaultHighlights: readBooleanOrDefault(raw.defaultHighlights, DEFAULTS.defaultHighlights),
    defaultModeration: readBooleanOrDefault(raw.defaultModeration, DEFAULTS.defaultModeration),
    defaultLivecrawl: normalizeLivecrawl(raw.defaultLivecrawl),
    resultTextChars,
  };
  return cfg;
}

function readNumberOrDefault(raw: unknown, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  return fallback;
}

function readBooleanOrDefault(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") {
    return raw;
  }
  return fallback;
}

function resolveApiKey(cfg: ResolvedConfig): string {
  const fromEnv = sanitizeApiKey(process.env.EXA_API_KEY);
  const key = cfg.apiKey ?? fromEnv;
  if (!key) {
    throw new Error(
      "missing Exa API key. Set plugins.entries.exa-search.config.apiKey or EXA_API_KEY env var.",
    );
  }
  return key;
}

function truncate(value: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}...`;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function readHighlights(record: Record<string, unknown>): string[] {
  const value = record.highlights;
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readSummary(record: Record<string, unknown>): string | undefined {
  const value = record.summary;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (isRecord(value)) {
    const text = readOptionalString(value, "text");
    if (text) {
      return text;
    }
    const summary = readOptionalString(value, "summary");
    if (summary) {
      return summary;
    }
  }
  return undefined;
}

function readText(record: Record<string, unknown>, maxChars: number): string | undefined {
  const value = record.text;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? truncate(trimmed, maxChars) : undefined;
  }
  if (isRecord(value)) {
    const text = readOptionalString(value, "text") ?? readOptionalString(value, "content");
    if (text) {
      return truncate(text, maxChars);
    }
  }
  return undefined;
}

function clonePayload(payload: ToolPayload): ToolPayload {
  return JSON.parse(JSON.stringify(payload)) as ToolPayload;
}

function getCache(cacheKey: string): ToolPayload | undefined {
  const entry = MEMORY_CACHE.get(cacheKey);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    MEMORY_CACHE.delete(cacheKey);
    return undefined;
  }
  // Refresh insertion order for LRU behavior.
  MEMORY_CACHE.delete(cacheKey);
  MEMORY_CACHE.set(cacheKey, entry);
  return clonePayload(entry.payload);
}

function setCache(cacheKey: string, payload: ToolPayload, cfg: ResolvedConfig) {
  if (cfg.cacheTtlMs <= 0 || cfg.cacheMaxEntries <= 0) {
    return;
  }
  MEMORY_CACHE.set(cacheKey, {
    expiresAt: Date.now() + cfg.cacheTtlMs,
    payload: clonePayload(payload),
  });
  while (MEMORY_CACHE.size > cfg.cacheMaxEntries) {
    const oldest = MEMORY_CACHE.keys().next().value as string | undefined;
    if (!oldest) {
      break;
    }
    MEMORY_CACHE.delete(oldest);
  }
}

function buildRequest(params: Record<string, unknown>, cfg: ResolvedConfig) {
  const query = readStringParam(params, "query", { required: true, label: "query" });
  const type = normalizeSearchType(params.type, cfg.defaultType);
  const category = normalizeCategory(params.category);
  const maxAllowed = Math.min(100, cfg.maxNumResults);
  const numResults = clampInt(
    readNumberParam(params, "numResults", { integer: true }) ?? cfg.defaultNumResults,
    1,
    maxAllowed,
  );

  const includeDomains = readStringListParam(params, "includeDomains");
  const excludeDomains = readStringListParam(params, "excludeDomains");
  const includeText = readStringListParam(params, "includeText");
  const excludeText = readStringListParam(params, "excludeText");
  const additionalQueries = readStringListParam(params, "additionalQueries");
  const userLocation = normalizeCountryCode(readStringParam(params, "userLocation"));

  if (additionalQueries && additionalQueries.length > 0 && type !== "deep") {
    throw new Error("additionalQueries can only be used when type=deep");
  }

  if (category === COMPANY_CATEGORY) {
    if ((includeDomains && includeDomains.length > 0) || (excludeDomains && excludeDomains.length > 0)) {
      throw new Error("includeDomains/excludeDomains are not supported for category=company");
    }
  }
  if ((category === COMPANY_CATEGORY || PEOPLE_CATEGORIES.has(category ?? "")) && includeText?.length) {
    throw new Error("includeText is not supported for people/company category searches");
  }
  if ((category === COMPANY_CATEGORY || PEOPLE_CATEGORIES.has(category ?? "")) && excludeText?.length) {
    throw new Error("excludeText is not supported for people/company category searches");
  }

  const startPublishedDate = readDateParam(params, "startPublishedDate");
  const endPublishedDate = readDateParam(params, "endPublishedDate");
  const startCrawlDate = readDateParam(params, "startCrawlDate");
  const endCrawlDate = readDateParam(params, "endCrawlDate");
  if (category === COMPANY_CATEGORY || PEOPLE_CATEGORIES.has(category ?? "")) {
    if (startPublishedDate || endPublishedDate || startCrawlDate || endCrawlDate) {
      throw new Error(
        "start/end published/crawl date filters are not supported for people/company category searches",
      );
    }
  }

  const moderation = readBooleanParam(params, "moderation") ?? cfg.defaultModeration;

  const includeContentText = readBooleanParam(params, "includeContentText") ?? cfg.defaultText;
  const includeContentSummary = readBooleanParam(params, "includeContentSummary") ?? cfg.defaultSummary;
  const includeContentHighlights =
    readBooleanParam(params, "includeContentHighlights") ?? cfg.defaultHighlights;
  const livecrawl = normalizeLivecrawl(params.livecrawl) ?? cfg.defaultLivecrawl;
  const livecrawlTimeoutMs = readNumberParam(params, "livecrawlTimeoutMs", { integer: true });
  const subpages = readNumberParam(params, "subpages", { integer: true });
  const subpageTarget = readStringListParam(params, "subpageTarget");
  const context = readBooleanParam(params, "context");

  const contents: Record<string, unknown> = {};
  if (includeContentText) {
    contents.text = true;
  }
  if (includeContentSummary) {
    contents.summary = true;
  }
  if (includeContentHighlights) {
    contents.highlights = true;
  }
  if (livecrawl) {
    contents.livecrawl = livecrawl;
  }
  if (livecrawlTimeoutMs !== undefined) {
    contents.livecrawlTimeout = clampInt(livecrawlTimeoutMs, 500, 120_000);
  }
  if (subpages !== undefined) {
    contents.subpages = clampInt(subpages, 0, 200);
  }
  if (subpageTarget && subpageTarget.length > 0) {
    contents.subpageTarget = subpageTarget;
  }
  if (context !== undefined) {
    contents.context = context;
  }

  const body: SearchBody = {
    query,
    type,
    numResults,
    moderation,
  };
  if (category) {
    body.category = category;
  }
  if (includeDomains && includeDomains.length > 0) {
    body.includeDomains = includeDomains;
  }
  if (excludeDomains && excludeDomains.length > 0) {
    body.excludeDomains = excludeDomains;
  }
  if (includeText && includeText.length > 0) {
    body.includeText = includeText;
  }
  if (excludeText && excludeText.length > 0) {
    body.excludeText = excludeText;
  }
  if (startPublishedDate) {
    body.startPublishedDate = startPublishedDate;
  }
  if (endPublishedDate) {
    body.endPublishedDate = endPublishedDate;
  }
  if (startCrawlDate) {
    body.startCrawlDate = startCrawlDate;
  }
  if (endCrawlDate) {
    body.endCrawlDate = endCrawlDate;
  }
  if (additionalQueries && additionalQueries.length > 0) {
    body.additionalQueries = additionalQueries;
  }
  if (userLocation) {
    body.userLocation = userLocation;
  }
  if (Object.keys(contents).length > 0) {
    body.contents = contents;
  }

  const resultTextChars = clampInt(
    readNumberParam(params, "resultTextChars", { integer: true }) ?? cfg.resultTextChars,
    0,
    20_000,
  );
  const useCache = readBooleanParam(params, "useCache") ?? cfg.cacheTtlMs > 0;
  const cacheKey = stableStringify({
    endpoint: "search",
    body,
    resultTextChars,
  });

  return { body, resultTextChars, useCache, cacheKey };
}

function formatFailureMessage(status: number, bodyText: string): string {
  const parsed = safeJsonParse(bodyText);
  if (isRecord(parsed)) {
    const message = readOptionalString(parsed, "message") ?? readOptionalString(parsed, "error");
    if (message) {
      return `Exa API ${status}: ${message}`;
    }
    const detail = readOptionalString(parsed, "detail");
    if (detail) {
      return `Exa API ${status}: ${detail}`;
    }
  }
  const text = bodyText.trim();
  if (text) {
    return `Exa API ${status}: ${truncate(text, 400)}`;
  }
  return `Exa API ${status}: request failed`;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

async function performSearch(params: {
  endpoint: string;
  apiKey: string;
  body: SearchBody;
  cfg: ResolvedConfig;
  logger: OpenClawPluginApi["logger"];
}): Promise<{ response: SearchResponse; retriesUsed: number }> {
  const { endpoint, apiKey, body, cfg, logger } = params;
  let retriesUsed = 0;

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-api-key": apiKey,
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await response.text();
      const retryAfterMs = readRetryAfterMs(response.headers.get("retry-after"));

      if (!response.ok) {
        const message = formatFailureMessage(response.status, rawText);
        if (attempt < cfg.retries && shouldRetryStatus(response.status)) {
          retriesUsed++;
          const delay = backoffDelayMs(cfg, attempt, retryAfterMs);
          logger.warn(
            `[exa-search] retry ${attempt + 1}/${cfg.retries} after HTTP ${response.status}; sleeping ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }
        throw new Error(message);
      }

      const parsed = safeJsonParse(rawText);
      if (!isRecord(parsed)) {
        throw new Error("Exa API returned a non-JSON response");
      }
      return { response: parsed as SearchResponse, retriesUsed };
    } catch (err) {
      const retryable = isAbortError(err) || err instanceof TypeError;
      if (attempt < cfg.retries && retryable) {
        retriesUsed++;
        const delay = backoffDelayMs(cfg, attempt, undefined);
        logger.warn(
          `[exa-search] retry ${attempt + 1}/${cfg.retries} after network/timeout error; sleeping ${delay}ms`,
        );
        await sleep(delay);
        continue;
      }
      if (isAbortError(err)) {
        throw new Error(`Exa API request timed out after ${cfg.timeoutMs}ms`);
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Exa API request exhausted retry attempts");
}

function normalizeResults(results: unknown[], resultTextChars: number): Array<Record<string, unknown>> {
  const normalized: Array<Record<string, unknown>> = [];
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!isRecord(row)) {
      continue;
    }
    const normalizedRow: Record<string, unknown> = {
      rank: i + 1,
      id: readOptionalString(row, "id"),
      title: readOptionalString(row, "title"),
      url: readOptionalString(row, "url"),
      author: readOptionalString(row, "author"),
      publishedDate: readOptionalString(row, "publishedDate"),
      crawlDate: readOptionalString(row, "crawlDate"),
      score: readOptionalNumber(row, "score"),
      summary: readSummary(row),
      highlights: readHighlights(row),
      text: readText(row, resultTextChars),
      favicon: readOptionalString(row, "favicon"),
      image: readOptionalString(row, "image"),
    };
    // Remove undefined keys to keep payload compact.
    for (const key of Object.keys(normalizedRow)) {
      if (normalizedRow[key] === undefined) {
        delete normalizedRow[key];
      }
    }
    normalized.push(normalizedRow);
  }
  return normalized;
}

function buildPayload(params: {
  response: SearchResponse;
  retriesUsed: number;
  body: SearchBody;
  endpoint: string;
  cacheKey: string;
  resultTextChars: number;
  cacheHit: boolean;
}): ToolPayload {
  const results = Array.isArray(params.response.results) ? params.response.results : [];
  const warnings: string[] = [];
  if (!Array.isArray(params.response.results)) {
    warnings.push("Exa response.results is missing or not an array");
  }
  if (results.length === 0) {
    warnings.push("Exa returned no results");
  }

  return {
    ok: true,
    provider: "exa",
    cache: {
      hit: params.cacheHit,
      key: params.cacheKey,
      fetchedAt: new Date().toISOString(),
    },
    request: {
      body: params.body,
      endpoint: params.endpoint,
    },
    meta: {
      requestId: typeof params.response.requestId === "string" ? params.response.requestId : undefined,
      searchType:
        (typeof params.response.resolvedSearchType === "string"
          ? params.response.resolvedSearchType
          : undefined) ||
        (typeof params.response.searchType === "string" ? params.response.searchType : undefined),
      autoDate: typeof params.response.autoDate === "string" ? params.response.autoDate : undefined,
      costDollars:
        typeof params.response.costDollars === "number" && Number.isFinite(params.response.costDollars)
          ? params.response.costDollars
          : undefined,
      statuses: params.response.statuses,
      warnings,
      retriesUsed: params.retriesUsed,
    },
    resultCount: results.length,
    results: normalizeResults(results, params.resultTextChars),
  };
}

export default function register(api: OpenClawPluginApi) {
  api.registerTool({
    name: "exa_search",
    description:
      "High-availability Exa web search with retries, timeout, caching, domain/date/category filters, and optional content extraction.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        type: {
          type: "string",
          enum: SEARCH_TYPES,
          description: "Exa search type.",
        },
        numResults: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Requested number of results.",
        },
        category: {
          type: "string",
          enum: CATEGORIES,
          description: "Optional category filter.",
        },
        userLocation: {
          type: "string",
          description: "Two-letter country code (ISO-3166 alpha-2).",
        },
        includeDomains: {
          type: "array",
          items: { type: "string" },
          description: "Only include these domains.",
        },
        excludeDomains: {
          type: "array",
          items: { type: "string" },
          description: "Exclude these domains.",
        },
        includeText: {
          type: "array",
          items: { type: "string" },
          description: "Only include results containing these terms.",
        },
        excludeText: {
          type: "array",
          items: { type: "string" },
          description: "Exclude results containing these terms.",
        },
        startPublishedDate: {
          type: "string",
          description: "Start of publish date range (ISO date/datetime).",
        },
        endPublishedDate: {
          type: "string",
          description: "End of publish date range (ISO date/datetime).",
        },
        startCrawlDate: {
          type: "string",
          description: "Start of crawl date range (ISO date/datetime).",
        },
        endCrawlDate: {
          type: "string",
          description: "End of crawl date range (ISO date/datetime).",
        },
        additionalQueries: {
          type: "array",
          items: { type: "string" },
          description: "Secondary queries (requires type=deep).",
        },
        moderation: {
          type: "boolean",
          description: "Enable moderation filtering.",
        },
        includeContentText: {
          type: "boolean",
          description: "Include extracted content text.",
        },
        includeContentSummary: {
          type: "boolean",
          description: "Include Exa summary.",
        },
        includeContentHighlights: {
          type: "boolean",
          description: "Include Exa highlights.",
        },
        livecrawl: {
          type: "string",
          enum: LIVECRAWL_MODES,
          description: "Livecrawl mode for content extraction.",
        },
        livecrawlTimeoutMs: {
          type: "integer",
          minimum: 500,
          description: "Livecrawl timeout in milliseconds.",
        },
        subpages: {
          type: "integer",
          minimum: 0,
          description: "Number of subpages to crawl.",
        },
        subpageTarget: {
          type: "array",
          items: { type: "string" },
          description: "Only include matching subpages.",
        },
        context: {
          type: "boolean",
          description: "Include sentence-level context for highlights/text.",
        },
        resultTextChars: {
          type: "integer",
          minimum: 0,
          description: "Max text characters returned per result.",
        },
        useCache: {
          type: "boolean",
          description: "Use in-memory response cache for repeated queries.",
        },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = readConfig(api);
      const apiKey = resolveApiKey(cfg);
      const { body, resultTextChars, useCache, cacheKey } = buildRequest(params, cfg);
      const endpoint = `${cfg.baseUrl}/search`;

      if (useCache) {
        const cached = getCache(cacheKey);
        if (cached) {
          cached.cache.hit = true;
          return jsonResult(cached);
        }
      }

      const inflight = INFLIGHT.get(cacheKey);
      if (inflight) {
        const shared = clonePayload(await inflight);
        shared.cache.hit = true;
        return jsonResult(shared);
      }

      const task = (async () => {
        const { response, retriesUsed } = await performSearch({
          endpoint,
          apiKey,
          body,
          cfg,
          logger: api.logger,
        });
        const payload = buildPayload({
          response,
          retriesUsed,
          body,
          endpoint,
          cacheKey,
          resultTextChars,
          cacheHit: false,
        });
        if (useCache) {
          setCache(cacheKey, payload, cfg);
        }
        return payload;
      })();

      INFLIGHT.set(cacheKey, task);
      try {
        const payload = await task;
        return jsonResult(payload);
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(`exa_search failed: ${err.message}`);
        }
        throw new Error(`exa_search failed: ${String(err)}`);
      } finally {
        INFLIGHT.delete(cacheKey);
      }
    },
  });
}
