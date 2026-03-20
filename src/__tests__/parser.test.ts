import { describe, it, expect } from "vitest";
import { parsePerplexityResponse, isParseError } from "../core/parser.js";
import type { ResearchInput } from "../schemas/input.js";
import type { PerplexityResponse } from "../core/perplexity.js";

const baseInput: ResearchInput = {
  title: "Test Research",
  query: "What is quantum computing?",
  depth: "deep",
  citationFormat: "APA",
  language: "en",
};

const baseResponse: PerplexityResponse = {
  content: "",
  model: "sonar-reasoning-pro",
};

const validDoc = {
  meta: {
    title: "Test Research",
    generatedAt: "2024-01-01T00:00:00.000Z",
    depth: "deep",
    citationFormat: "APA",
    language: "en",
    model: "sonar-reasoning-pro",
  },
  executiveSummary: "Quantum computing uses quantum mechanics to process information.",
  keyFindings: [
    {
      id: 1,
      finding: "Quantum computers can solve certain problems exponentially faster.",
      confidence: "high",
      sourceIds: [1],
    },
  ],
  technicalAnalysis: {
    methodology: "Literature review",
    details: "In-depth analysis of quantum computing principles.",
    limitations: "Limited to publicly available research.",
  },
  bibliography: [
    {
      id: 1,
      formattedCitation: "Author, A. (2024). Quantum Computing. Publisher.",
      url: "https://example.com/quantum",
      accessDate: "2024-01-01",
      verified: false,
    },
  ],
  validation: {
    totalCitations: 1,
    verifiedCitations: 0,
    unmatchedClaims: [],
  },
};

function makeContent(doc: unknown): string {
  return "```json\n" + JSON.stringify(doc) + "\n```";
}

describe("parsePerplexityResponse", () => {
  it("parses a valid JSON document from a markdown code fence", () => {
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(validDoc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.output.meta.title).toBe("Test Research");
      expect(result.output.keyFindings).toHaveLength(1);
      expect(result.parseWarnings).toHaveLength(0);
    }
  });

  it("parses a valid JSON document without code fence (bare JSON)", () => {
    const result = parsePerplexityResponse(
      { ...baseResponse, content: JSON.stringify(validDoc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(false);
  });

  it("handles ```json code fence variant", () => {
    const content = "```json\n" + JSON.stringify(validDoc) + "\n```";
    const result = parsePerplexityResponse({ ...baseResponse, content }, baseInput);
    expect(isParseError(result)).toBe(false);
  });

  it("returns ParseError when no JSON is present", () => {
    const result = parsePerplexityResponse(
      { ...baseResponse, content: "I could not find any relevant information." },
      baseInput,
    );
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("No JSON object found");
    }
  });

  it("returns ParseError when JSON is completely broken", () => {
    const result = parsePerplexityResponse(
      { ...baseResponse, content: "```json\nnot json at all {{{```" },
      baseInput,
    );
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("Failed to parse JSON");
    }
  });

  it("fills missing meta fields from input", () => {
    const doc = { ...validDoc, meta: undefined };
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(doc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.output.meta.title).toBe(baseInput.title);
      expect(result.output.meta.depth).toBe(baseInput.depth);
      expect(result.output.meta.citationFormat).toBe(baseInput.citationFormat);
      expect(result.output.meta.language).toBe(baseInput.language);
      expect(result.output.meta.model).toBe(baseResponse.model);
      expect(result.parseWarnings.some((w) => w.includes("meta block"))).toBe(true);
    }
  });

  it("fills missing validation block", () => {
    const doc = { ...validDoc, validation: undefined };
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(doc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.output.validation.totalCitations).toBe(1);
      expect(result.output.validation.verifiedCitations).toBe(0);
      expect(result.output.validation.unmatchedClaims).toEqual([]);
      expect(result.parseWarnings.some((w) => w.includes("validation block"))).toBe(true);
    }
  });

  it("fills missing accessDate in bibliography entries", () => {
    const doc = {
      ...validDoc,
      bibliography: [{ ...validDoc.bibliography[0], accessDate: undefined }],
    };
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(doc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.output.bibliography[0].accessDate).toBeTruthy();
      expect(result.parseWarnings.some((w) => w.includes("accessDate"))).toBe(true);
    }
  });

  it("returns ParseError when schema validation fails (missing executiveSummary)", () => {
    const doc = { ...validDoc, executiveSummary: undefined };
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(doc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("Schema validation failed");
    }
  });

  it("returns ParseError when keyFindings is empty (schema requires min 1)", () => {
    const doc = { ...validDoc, keyFindings: [] };
    const result = parsePerplexityResponse(
      { ...baseResponse, content: makeContent(doc) },
      baseInput,
    );
    expect(isParseError(result)).toBe(true);
  });

  it("includes rawContent in ParseError", () => {
    const content = "no json here";
    const result = parsePerplexityResponse({ ...baseResponse, content }, baseInput);
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.rawContent).toBe(content);
    }
  });

  it("attempts repair on truncated JSON", () => {
    // Truncate after the bibliography entry — missing closing braces
    const full = JSON.stringify(validDoc);
    const truncated = "```json\n" + full.slice(0, full.length - 20) + "\n```";
    const result = parsePerplexityResponse({ ...baseResponse, content: truncated }, baseInput);
    // Repair may or may not succeed, but should not throw
    expect(result).toBeDefined();
  });
});

describe("isParseError", () => {
  it("returns true for ParseError", () => {
    expect(isParseError({ error: "oops", rawContent: "" })).toBe(true);
  });

  it("returns false for ParseResult", () => {
    const fakeResult = { output: validDoc as never, parseWarnings: [] };
    expect(isParseError(fakeResult)).toBe(false);
  });
});
