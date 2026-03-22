import { describe, it, expect } from "vitest";
import { formatPretty } from "../formatters/pretty.js";
import type { ResearchOutput } from "../schemas/output.js";

const doc: ResearchOutput = {
  meta: {
    title: "Quantum Computing Overview",
    generatedAt: "2024-01-01T00:00:00.000Z",
    depth: "deep",
    citationFormat: "APA",
    language: "en",
    model: "sonar-reasoning-pro",
  },
  executiveSummary: "Quantum computing is a paradigm that uses quantum mechanics.",
  keyFindings: [
    {
      id: 1,
      finding: "Quantum computers can factor large integers efficiently.",
      confidence: "high",
      sourceIds: [1, 2],
    },
    {
      id: 2,
      finding: "Current hardware is still error-prone.",
      confidence: "medium",
      sourceIds: [2],
    },
    {
      id: 3,
      finding: "Commercial applications remain limited.",
      confidence: "low",
      sourceIds: [3],
    },
  ],
  technicalAnalysis: {
    methodology: "Systematic literature review",
    details: "An in-depth analysis of quantum computing principles and hardware.",
    limitations: "Limited to peer-reviewed publications from 2020–2024.",
  },
  bibliography: [
    {
      id: 1,
      formattedCitation: "Author, A. (2023). Quantum Basics. Publisher.",
      url: "https://example.com/1",
      accessDate: "2024-01-01",
      verified: true,
    },
    {
      id: 2,
      formattedCitation: "Author, B. (2022). Quantum Hardware. Publisher.",
      url: "https://example.com/2",
      accessDate: "2024-01-01",
      verified: false,
    },
    {
      id: 3,
      formattedCitation: "Author, C. (2021). Quantum Commerce. Publisher.",
      url: "https://example.com/3",
      accessDate: "2024-01-01",
      verified: false,
    },
  ],
  validation: {
    totalCitations: 3,
    verifiedCitations: 1,
    unmatchedClaims: [],
  },
};

describe("formatPretty", () => {
  it("returns a non-empty string", () => {
    const result = formatPretty(doc);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the document title", () => {
    const result = formatPretty(doc);
    expect(result).toContain("Quantum Computing Overview");
  });

  it("includes the executive summary", () => {
    const result = formatPretty(doc);
    expect(result).toContain("Quantum computing is a paradigm");
  });

  it("includes all key findings", () => {
    const result = formatPretty(doc);
    expect(result).toContain("Quantum computers can factor large integers efficiently.");
    expect(result).toContain("Current hardware is still error-prone.");
    expect(result).toContain("Commercial applications remain limited.");
  });

  it("includes source ids for each finding", () => {
    const result = formatPretty(doc);
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
    expect(result).toContain("[3]");
  });

  it("includes confidence levels", () => {
    const result = formatPretty(doc);
    expect(result).toContain("high");
    expect(result).toContain("medium");
    expect(result).toContain("low");
  });

  it("includes technical analysis sections", () => {
    const result = formatPretty(doc);
    expect(result).toContain("Systematic literature review");
    expect(result).toContain("An in-depth analysis");
    expect(result).toContain("Limited to peer-reviewed publications");
  });

  it("includes bibliography entries", () => {
    const result = formatPretty(doc);
    expect(result).toContain("Author, A. (2023). Quantum Basics. Publisher.");
    expect(result).toContain("https://example.com/1");
  });

  it("includes validation footer", () => {
    const result = formatPretty(doc);
    expect(result).toContain("3 total citations");
    expect(result).toContain("1 verified");
  });

  it("does not include unmatched claims section when there are none", () => {
    const result = formatPretty(doc);
    expect(result).not.toContain("Unmatched claims");
  });

  it("includes unmatched claims when present", () => {
    const docWithClaims: ResearchOutput = {
      ...doc,
      validation: { ...doc.validation, unmatchedClaims: ["Claim A has no citation"] },
    };
    const result = formatPretty(docWithClaims);
    expect(result).toContain("Unmatched claims");
    expect(result).toContain("Claim A has no citation");
  });

  it("includes model and depth metadata", () => {
    const result = formatPretty(doc);
    expect(result).toContain("sonar-reasoning-pro");
    expect(result).toContain("deep");
    expect(result).toContain("APA");
  });
});
