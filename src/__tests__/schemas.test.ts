import { describe, it, expect } from "vitest";
import { ResearchInputSchema } from "../schemas/input.js";
import {
  ResearchOutputSchema,
  KeyFindingSchema,
  BibliographyEntrySchema,
} from "../schemas/output.js";

describe("ResearchInputSchema", () => {
  it("accepts valid input with all fields", () => {
    const input = {
      title: "Quantum Computing Overview",
      query: "What are the latest advances in quantum computing?",
      depth: "deep",
      citationFormat: "APA",
      language: "en",
    };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Quantum Computing Overview");
      expect(result.data.depth).toBe("deep");
    }
  });

  it("applies defaults for optional fields", () => {
    const input = {
      title: "Test",
      query: "Test query",
    };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depth).toBe("deep");
      expect(result.data.citationFormat).toBe("APA");
      expect(result.data.language).toBe("en");
    }
  });

  it("rejects empty title", () => {
    const input = { title: "", query: "Some query" };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty query", () => {
    const input = { title: "Title", query: "" };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid depth", () => {
    const input = { title: "T", query: "Q", depth: "medium" };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid citation format", () => {
    const input = { title: "T", query: "Q", citationFormat: "Chicago" };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 characters", () => {
    const input = { title: "A".repeat(201), query: "Q" };
    const result = ResearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("KeyFindingSchema", () => {
  it("accepts a valid key finding", () => {
    const finding = {
      id: 1,
      finding: "Quantum supremacy achieved",
      confidence: "high",
      sourceIds: [1, 2],
    };
    const result = KeyFindingSchema.safeParse(finding);
    expect(result.success).toBe(true);
  });

  it("rejects non-positive id", () => {
    const finding = {
      id: 0,
      finding: "Test",
      confidence: "high",
      sourceIds: [],
    };
    const result = KeyFindingSchema.safeParse(finding);
    expect(result.success).toBe(false);
  });
});

describe("BibliographyEntrySchema", () => {
  it("accepts a valid bibliography entry", () => {
    const entry = {
      id: 1,
      formattedCitation: "Author, A. (2024). Title. Journal.",
      url: "https://example.com/paper",
      accessDate: "2024-01-15",
      verified: true,
    };
    const result = BibliographyEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const entry = {
      id: 1,
      formattedCitation: "Citation",
      url: "not-a-url",
      accessDate: "2024-01-15",
    };
    const result = BibliographyEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("defaults verified to false", () => {
    const entry = {
      id: 1,
      formattedCitation: "Citation",
      url: "https://example.com",
      accessDate: "2024-01-15",
    };
    const result = BibliographyEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verified).toBe(false);
    }
  });
});

describe("ResearchOutputSchema", () => {
  const validOutput = {
    meta: {
      title: "Test Research",
      generatedAt: "2024-01-15T10:00:00Z",
      depth: "deep",
      citationFormat: "APA",
      language: "en",
      model: "sonar-reasoning-pro",
    },
    executiveSummary: "This is the executive summary.",
    keyFindings: [
      {
        id: 1,
        finding: "Important discovery",
        confidence: "high",
        sourceIds: [1],
      },
    ],
    technicalAnalysis: {
      methodology: "Literature review",
      details: "Detailed analysis of current research.",
      limitations: "Limited to English-language sources.",
    },
    bibliography: [
      {
        id: 1,
        formattedCitation: "Author, A. (2024). Title.",
        url: "https://example.com",
        accessDate: "2024-01-15",
        verified: true,
      },
    ],
    validation: {
      totalCitations: 1,
      verifiedCitations: 1,
      unmatchedClaims: [],
    },
  };

  it("accepts a fully valid research output", () => {
    const result = ResearchOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects output with empty keyFindings", () => {
    const invalid = { ...validOutput, keyFindings: [] };
    const result = ResearchOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects output with missing executiveSummary", () => {
    const { executiveSummary: _, ...invalid } = validOutput;
    const result = ResearchOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
