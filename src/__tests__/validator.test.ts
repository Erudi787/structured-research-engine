import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyCitations } from "../core/validator.js";
import type { ResearchOutput } from "../schemas/output.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOutput(overrides: Partial<ResearchOutput> = {}): ResearchOutput {
  return {
    meta: {
      title: "Test",
      generatedAt: "2024-01-01T00:00:00.000Z",
      depth: "deep",
      citationFormat: "APA",
      language: "en",
      model: "sonar-reasoning-pro",
    },
    executiveSummary: "Quantum computing is transformative [1].",
    keyFindings: [
      { id: 1, finding: "Speed improvements are significant [2].", confidence: "high", sourceIds: [1, 2] },
    ],
    technicalAnalysis: {
      methodology: "Literature review",
      details: "Details reference multiple studies [1][2][3].",
      limitations: "Limited scope.",
    },
    bibliography: [
      { id: 1, formattedCitation: "Author A (2023).", url: "https://example.com/1", accessDate: "2024-01-01", verified: false },
      { id: 2, formattedCitation: "Author B (2022).", url: "https://example.com/2", accessDate: "2024-01-01", verified: false },
      { id: 3, formattedCitation: "Author C (2021).", url: "https://example.com/3", accessDate: "2024-01-01", verified: false },
    ],
    validation: { totalCitations: 3, verifiedCitations: 0, unmatchedClaims: [] },
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.stubGlobal("fetch", vi.fn(handler));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── URL Verification ──────────────────────────────────────────────────────────

describe("URL verification", () => {
  it("marks entries as verified when HEAD returns 200", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const { output } = await verifyCitations(makeOutput());
    expect(output.bibliography.every((e) => e.verified)).toBe(true);
  });

  it("marks entries as verified when HEAD returns a 3xx redirect", async () => {
    mockFetch(() => new Response(null, { status: 301 }));
    const { output } = await verifyCitations(makeOutput());
    expect(output.bibliography.every((e) => e.verified)).toBe(true);
  });

  it("marks entries as unverified when HEAD returns 404", async () => {
    mockFetch(() => new Response(null, { status: 404 }));
    const { output } = await verifyCitations(makeOutput());
    expect(output.bibliography.every((e) => !e.verified)).toBe(true);
  });

  it("marks entries as unverified when fetch throws (network error)", async () => {
    mockFetch(() => { throw new Error("network error"); });
    const { output } = await verifyCitations(makeOutput());
    expect(output.bibliography.every((e) => !e.verified)).toBe(true);
  });

  it("marks entries as unverified when request times out (abort)", async () => {
    mockFetch((_url) => {
      return new Promise<Response>((_resolve, reject) => {
        setTimeout(() => reject(new DOMException("aborted", "AbortError")), 10);
      });
    });
    const { output } = await verifyCitations(makeOutput(), 5);
    expect(output.bibliography.every((e) => !e.verified)).toBe(true);
  });

  it("emits a warning for each unreachable URL", async () => {
    mockFetch(() => new Response(null, { status: 503 }));
    const { verificationWarnings } = await verifyCitations(makeOutput());
    expect(verificationWarnings.filter((w) => w.includes("URL unreachable"))).toHaveLength(3);
  });

  it("emits no URL warnings when all entries are reachable", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const { verificationWarnings } = await verifyCitations(makeOutput());
    expect(verificationWarnings.filter((w) => w.includes("URL unreachable"))).toHaveLength(0);
  });

  it("handles mixed reachability correctly", async () => {
    let call = 0;
    mockFetch(() => {
      call++;
      return new Response(null, { status: call === 2 ? 404 : 200 });
    });
    const { output } = await verifyCitations(makeOutput());
    const verified = output.bibliography.map((e) => e.verified);
    expect(verified[0]).toBe(true);
    expect(verified[1]).toBe(false);
    expect(verified[2]).toBe(true);
  });
});

// ── Validation block population ───────────────────────────────────────────────

describe("validation block", () => {
  it("sets totalCitations to bibliography length", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const { output } = await verifyCitations(makeOutput());
    expect(output.validation.totalCitations).toBe(3);
  });

  it("sets verifiedCitations to count of verified entries", async () => {
    let call = 0;
    mockFetch(() => {
      call++;
      return new Response(null, { status: call <= 2 ? 200 : 404 });
    });
    const { output } = await verifyCitations(makeOutput());
    expect(output.validation.verifiedCitations).toBe(2);
  });

  it("sets verifiedCitations to 0 when all fail", async () => {
    mockFetch(() => new Response(null, { status: 500 }));
    const { output } = await verifyCitations(makeOutput());
    expect(output.validation.verifiedCitations).toBe(0);
  });

  it("handles empty bibliography", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const doc = makeOutput({ bibliography: [], validation: { totalCitations: 0, verifiedCitations: 0, unmatchedClaims: [] } });
    const { output } = await verifyCitations(doc);
    expect(output.validation.totalCitations).toBe(0);
    expect(output.validation.verifiedCitations).toBe(0);
  });
});

// ── Cross-reference / unmatched claims ───────────────────────────────────────

describe("cross-reference", () => {
  it("produces no unmatched claims when all references are covered", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const { output } = await verifyCitations(makeOutput());
    // text references [1][2][3], bibliography has ids 1,2,3
    expect(output.validation.unmatchedClaims).toHaveLength(0);
  });

  it("flags a reference with no matching bibliography entry", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    // executiveSummary references [9] which has no bibliography entry
    const doc = makeOutput({
      executiveSummary: "This is unverified [9].",
      technicalAnalysis: {
        methodology: "review",
        details: "details [1].",
        limitations: "none",
      },
    });
    const { output, verificationWarnings } = await verifyCitations(doc);
    expect(output.validation.unmatchedClaims).toHaveLength(1);
    expect(output.validation.unmatchedClaims[0]).toContain("[9]");
    expect(verificationWarnings.some((w) => w.includes("[9]"))).toBe(true);
  });

  it("scans executiveSummary for citation refs", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const doc = makeOutput({
      executiveSummary: "Found in summary [99].",
      keyFindings: [{ id: 1, finding: "Finding.", confidence: "high", sourceIds: [1] }],
      technicalAnalysis: { methodology: "m", details: "d [1].", limitations: "l" },
      bibliography: [
        { id: 1, formattedCitation: "A.", url: "https://example.com/1", accessDate: "2024-01-01", verified: false },
      ],
      validation: { totalCitations: 1, verifiedCitations: 0, unmatchedClaims: [] },
    });
    const { output } = await verifyCitations(doc);
    expect(output.validation.unmatchedClaims.some((c) => c.includes("[99]"))).toBe(true);
  });

  it("scans technicalAnalysis.details for citation refs", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const doc = makeOutput({
      executiveSummary: "Summary.",
      technicalAnalysis: { methodology: "m", details: "Details reference [88].", limitations: "l" },
      bibliography: [
        { id: 1, formattedCitation: "A.", url: "https://example.com/1", accessDate: "2024-01-01", verified: false },
      ],
      validation: { totalCitations: 1, verifiedCitations: 0, unmatchedClaims: [] },
    });
    const { output } = await verifyCitations(doc);
    expect(output.validation.unmatchedClaims.some((c) => c.includes("[88]"))).toBe(true);
  });

  it("scans all keyFinding.finding fields for citation refs", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const doc = makeOutput({
      executiveSummary: "Summary.",
      keyFindings: [
        { id: 1, finding: "Finding cites [77].", confidence: "high", sourceIds: [1] },
      ],
      technicalAnalysis: { methodology: "m", details: "d.", limitations: "l" },
      bibliography: [
        { id: 1, formattedCitation: "A.", url: "https://example.com/1", accessDate: "2024-01-01", verified: false },
      ],
      validation: { totalCitations: 1, verifiedCitations: 0, unmatchedClaims: [] },
    });
    const { output } = await verifyCitations(doc);
    expect(output.validation.unmatchedClaims.some((c) => c.includes("[77]"))).toBe(true);
  });

  it("deduplicates the same unmatched reference appearing multiple times", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const doc = makeOutput({
      executiveSummary: "See [99] and also [99].",
      technicalAnalysis: { methodology: "m", details: "d [99].", limitations: "l" },
      bibliography: [],
      validation: { totalCitations: 0, verifiedCitations: 0, unmatchedClaims: [] },
    });
    const { output } = await verifyCitations(doc);
    const matches = output.validation.unmatchedClaims.filter((c) => c.includes("[99]"));
    expect(matches).toHaveLength(1);
  });
});
