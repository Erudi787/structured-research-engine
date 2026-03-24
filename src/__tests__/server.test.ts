import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServer, type ServerDeps } from "../server.js";
import type { ResearchOutput } from "../schemas/output.js";

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeOutput(): ResearchOutput {
  return {
    meta: {
      title: "Test Research",
      generatedAt: "2024-01-01T00:00:00.000Z",
      depth: "deep",
      citationFormat: "APA",
      language: "en",
      model: "sonar-reasoning-pro",
    },
    executiveSummary: "Test summary.",
    keyFindings: [
      { id: 1, finding: "Finding one.", confidence: "high", sourceIds: [1] },
    ],
    technicalAnalysis: { methodology: "Review", details: "Details.", limitations: "None." },
    bibliography: [
      {
        id: 1,
        formattedCitation: "Author (2024).",
        url: "https://example.com",
        accessDate: "2024-01-01",
        verified: true,
      },
    ],
    validation: { totalCitations: 1, verifiedCitations: 1, unmatchedClaims: [] },
  };
}

const validBody = {
  title: "Test Research",
  query: "What is AI?",
  depth: "deep",
  citationFormat: "APA",
  language: "en",
};

// ── Default test deps ─────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    loadConfig: vi.fn(() => ({ perplexityApiKey: "test-key", rateLimitRpm: 50 })),
    createRateLimiter: vi.fn(() => ({}) as never),
    createClient: vi.fn(() => ({})),
    buildQuery: vi.fn(() => ({ systemPrompt: "sys", userPrompt: "user", model: "sonar-pro" as const })),
    callPerplexity: vi.fn(async () => ({ content: "{}", model: "sonar-reasoning-pro" })),
    parseResponse: vi.fn(() => ({ output: makeOutput(), parseWarnings: [] })),
    isParseError: vi.fn((r: unknown) => typeof r === "object" && r !== null && "error" in r),
    verifyCitations: vi.fn(async () => ({ output: makeOutput(), verificationWarnings: [] })),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });
});

describe("POST /research", () => {
  it("returns 200 with data and empty warnings on success", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    expect(body.data.meta.title).toBe("Test Research");
    expect(body.warnings).toEqual([]);
  });

  it("returns 400 when title is missing", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "What is AI?" }),
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Invalid request body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 400 when query is missing", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Invalid request body");
  });

  it("returns 400 when depth is an invalid value", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validBody, depth: "extreme" }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when citationFormat is invalid", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validBody, citationFormat: "Chicago" }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const server = createServer({}, makeDeps());
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.statusCode).toBe(400);
  });

  it("applies schema defaults — depth defaults to deep when omitted", async () => {
    const deps = makeDeps();
    const server = createServer({}, deps);
    await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test", query: "AI?" }),
    });
    expect(vi.mocked(deps.buildQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ depth: "deep" }),
    );
  });

  it("returns 500 when loadConfig throws", async () => {
    const deps = makeDeps({
      loadConfig: vi.fn(() => { throw new Error("PERPLEXITY_API_KEY is not set"); }),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toContain("PERPLEXITY_API_KEY");
  });

  it("returns 502 when callPerplexity throws", async () => {
    const deps = makeDeps({
      callPerplexity: vi.fn(async () => { throw new Error("rate limit exceeded"); }),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toContain("rate limit exceeded");
  });

  it("returns 500 when parseResponse returns a ParseError", async () => {
    const deps = makeDeps({
      parseResponse: vi.fn(() => ({ error: "No JSON found", rawContent: "bad" })),
      isParseError: vi.fn(() => true),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toContain("No JSON found");
  });

  it("includes parse warnings in the response", async () => {
    const deps = makeDeps({
      parseResponse: vi.fn(() => ({ output: makeOutput(), parseWarnings: ["meta block was missing"] })),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).warnings).toContain("meta block was missing");
  });

  it("includes verification warnings in the response", async () => {
    const deps = makeDeps({
      verifyCitations: vi.fn(async () => ({
        output: makeOutput(),
        verificationWarnings: ["[1] URL unreachable or timed out: https://example.com"],
      })),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(200);
    expect(
      JSON.parse(res.body).warnings.some((w: string) => w.includes("URL unreachable")),
    ).toBe(true);
  });

  it("merges parse warnings and verification warnings", async () => {
    const deps = makeDeps({
      parseResponse: vi.fn(() => ({ output: makeOutput(), parseWarnings: ["parse warning"] })),
      verifyCitations: vi.fn(async () => ({
        output: makeOutput(),
        verificationWarnings: ["verify warning"],
      })),
    });
    const server = createServer({}, deps);
    const res = await server.inject({
      method: "POST",
      url: "/research",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(200);
    const { warnings } = JSON.parse(res.body);
    expect(warnings).toContain("parse warning");
    expect(warnings).toContain("verify warning");
  });
});
