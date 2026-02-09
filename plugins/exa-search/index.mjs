function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clampInt(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  return Math.max(min, Math.min(max, rounded));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeIsoDateString(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function resolveApiKey(api) {
  const apiKeyEnv = typeof api?.pluginConfig?.apiKeyEnv === "string" ? api.pluginConfig.apiKeyEnv : "";
  const envName = apiKeyEnv.trim() || "EXA_API_KEY";
  const apiKey = (process.env[envName] ?? "").trim();
  if (!apiKey) {
    throw new Error(
      `Missing Exa API key. Set ${envName} in your environment (this repo: config/.env), then restart the gateway.`,
    );
  }
  return { apiKey, envName };
}

async function postJson(url, body, opts) {
  const timeoutMs = Math.max(2_000, clampInt(opts?.timeoutMs, 2_000, 120_000, 20_000));
  const headers = {
    "content-type": "application/json",
    ...(opts?.headers ?? {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.toLowerCase().includes("application/json");
    const text = await res.text();
    const parsed = isJson && text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        (isPlainObject(parsed) && typeof parsed.error === "string" && parsed.error.trim()) ||
        (isPlainObject(parsed) && isPlainObject(parsed.error) && typeof parsed.error.message === "string"
          ? parsed.error.message
          : "") ||
        (typeof text === "string" ? text.trim() : "");
      throw new Error(`Exa API error (${res.status}): ${message || "Unknown error"}`);
    }

    if (!parsed || !isPlainObject(parsed)) {
      throw new Error("Exa API returned non-JSON response");
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function buildContents(params) {
  const includeHighlights = params.includeHighlights !== false;
  const includeText = params.includeText === true;
  const includeSummary = params.includeSummary === true;

  if (!includeHighlights && !includeText && !includeSummary) {
    return undefined;
  }

  const contents = {};

  if (includeHighlights) {
    const highlightsNumSentences = clampInt(params.highlightsNumSentences, 1, 10, 2);
    const highlightsPerUrl = clampInt(params.highlightsPerUrl, 1, 10, 3);
    const highlightsQuery = typeof params.highlightsQuery === "string" ? params.highlightsQuery.trim() : "";

    contents.highlights = {
      numSentences: highlightsNumSentences,
      highlightsPerUrl,
      ...(highlightsQuery ? { query: highlightsQuery } : {}),
    };
  }

  if (includeText) {
    const textMaxCharacters = clampInt(params.textMaxCharacters, 256, 50_000, 4_000);
    const textIncludeHtmlTags = params.textIncludeHtmlTags === true;
    contents.text = {
      maxCharacters: textMaxCharacters,
      includeHtmlTags: textIncludeHtmlTags,
    };
  }

  if (includeSummary) {
    const summaryQuery = typeof params.summaryQuery === "string" ? params.summaryQuery.trim() : "";
    contents.summary = summaryQuery ? { query: summaryQuery } : true;
  }

  return contents;
}

function normalizeResults(results, includeText) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map((r) => {
      const url = typeof r?.url === "string" ? r.url : undefined;
      const title = typeof r?.title === "string" ? r.title : undefined;
      const publishedDate = typeof r?.publishedDate === "string" ? r.publishedDate : undefined;
      const author = typeof r?.author === "string" ? r.author : undefined;
      const score = typeof r?.score === "number" ? r.score : undefined;
      const id = typeof r?.id === "string" ? r.id : undefined;
      const highlights = Array.isArray(r?.highlights) ? r.highlights.filter((h) => typeof h === "string") : undefined;
      const summary = typeof r?.summary === "string" ? r.summary : undefined;
      const text = includeText && typeof r?.text === "string" ? r.text : undefined;

      return {
        id,
        title,
        url,
        author,
        publishedDate,
        score,
        ...(highlights && highlights.length > 0 ? { highlights } : {}),
        ...(summary ? { summary } : {}),
        ...(text ? { text } : {}),
      };
    })
    .filter((r) => Boolean(r.url || r.title));
}

function createExaSearchTool(api) {
  return {
    name: "exa_search",
    description:
      "Search the web via Exa Search API. Returns high-signal sources with titles/URLs and optional highlights/text/summary.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Search query." },
        type: {
          type: "string",
          description: 'Search type (examples: "auto", "neural", "fast", "deep", "keyword").',
        },
        category: { type: "string", description: "Optional category (e.g. 'research', 'news', 'company')." },
        numResults: { type: "number", description: "Number of results (1..25). Default: 5." },
        includeDomains: { type: "array", items: { type: "string" }, description: "Restrict results to these domains." },
        excludeDomains: { type: "array", items: { type: "string" }, description: "Exclude these domains." },
        startPublishedDate: { type: "string", description: "ISO date/time filter (start)." },
        endPublishedDate: { type: "string", description: "ISO date/time filter (end)." },
        useAutoprompt: { type: "boolean", description: "Let Exa rewrite the query for better retrieval." },
        filterIncludeText: {
          type: "array",
          items: { type: "string" },
          description: "Only include pages that contain these strings (Exa includeText).",
        },
        filterExcludeText: {
          type: "array",
          items: { type: "string" },
          description: "Exclude pages that contain these strings (Exa excludeText).",
        },
        includeHighlights: {
          type: "boolean",
          description: "Include highlight snippets. Default: true.",
        },
        highlightsNumSentences: {
          type: "number",
          description: "Highlight sentences per snippet (1..10). Default: 2.",
        },
        highlightsPerUrl: {
          type: "number",
          description: "Highlight snippets per URL (1..10). Default: 3.",
        },
        highlightsQuery: {
          type: "string",
          description: "Optional separate query used to generate highlights.",
        },
        includeText: {
          type: "boolean",
          description: "Include extracted page text (truncated). Default: false.",
        },
        textMaxCharacters: {
          type: "number",
          description: "Max characters for returned text (256..50000). Default: 4000.",
        },
        textIncludeHtmlTags: {
          type: "boolean",
          description: "Whether to keep HTML tags in returned text. Default: false.",
        },
        includeSummary: {
          type: "boolean",
          description: "Include Exa-generated summaries when available. Default: false.",
        },
        summaryQuery: {
          type: "string",
          description: "Optional summary query (prompt) for Exa summaries.",
        },
        returnRaw: {
          type: "boolean",
          description: "Return the raw Exa API JSON response (larger). Default: false.",
        },
        timeoutMs: { type: "number", description: "Request timeout in ms. Default: 20000." },
      },
      required: ["query"],
    },
    async execute(_id, params) {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        throw new Error("query required");
      }

      const { apiKey } = resolveApiKey(api);
      const numResults = clampInt(params.numResults, 1, 25, 5);
      const type = typeof params.type === "string" ? params.type.trim() : "";
      const category = typeof params.category === "string" ? params.category.trim() : "";
      const includeDomains = normalizeStringArray(params.includeDomains);
      const excludeDomains = normalizeStringArray(params.excludeDomains);
      const startPublishedDate = normalizeIsoDateString(params.startPublishedDate);
      const endPublishedDate = normalizeIsoDateString(params.endPublishedDate);
      const useAutoprompt = params.useAutoprompt === true;
      const includeText = params.includeText === true;
      const returnRaw = params.returnRaw === true;

      const body = {
        query,
        numResults,
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(includeDomains ? { includeDomains } : {}),
        ...(excludeDomains ? { excludeDomains } : {}),
        ...(startPublishedDate ? { startPublishedDate } : {}),
        ...(endPublishedDate ? { endPublishedDate } : {}),
        ...(useAutoprompt ? { useAutoprompt } : {}),
      };

      const filterIncludeText = normalizeStringArray(params.filterIncludeText);
      const filterExcludeText = normalizeStringArray(params.filterExcludeText);
      if (filterIncludeText) {
        body.includeText = filterIncludeText;
      }
      if (filterExcludeText) {
        body.excludeText = filterExcludeText;
      }

      const contents = buildContents(params);
      if (contents) {
        body.contents = contents;
      }

      const url = "https://api.exa.ai/search";
      const raw = await postJson(
        url,
        body,
        {
          timeoutMs: params.timeoutMs,
          headers: { "x-api-key": apiKey },
        },
      );

      const results = normalizeResults(raw.results, includeText);
      const response = {
        query,
        numResults,
        type: type || undefined,
        category: category || undefined,
        results,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(returnRaw ? raw : response, null, 2) }],
        details: returnRaw ? raw : response,
      };
    },
  };
}

export default function register(api) {
  api.registerTool(() => createExaSearchTool(api));
}

