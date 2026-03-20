import { describe, it, expect } from "vitest";
import { formatCitation, buildBibliographyFromUrls } from "../formatters/citations.js";
import type { RawCitation } from "../formatters/citations.js";

const fullCitation: RawCitation = {
  id: 1,
  url: "https://example.com/article",
  title: "Quantum Computing Overview",
  author: "Smith, J.",
  year: 2023,
  publisher: "Tech Press",
  accessDate: "2024-01-15",
};

describe("formatCitation", () => {
  describe("APA", () => {
    it("formats a full citation", () => {
      const result = formatCitation(fullCitation, "APA");
      expect(result).toBe(
        "Smith, J.. (2023). Quantum Computing Overview. Retrieved 2024-01-15, from https://example.com/article",
      );
    });

    it("uses defaults for missing optional fields", () => {
      const result = formatCitation({ id: 1, url: "https://example.com" }, "APA");
      expect(result).toContain("Unknown Author");
      expect(result).toContain("n.d.");
      expect(result).toContain("Untitled");
      expect(result).toContain("https://example.com");
    });
  });

  describe("MLA", () => {
    it("formats a full citation", () => {
      const result = formatCitation(fullCitation, "MLA");
      expect(result).toBe(
        'Smith, J.. "Quantum Computing Overview." Tech Press, 2023, https://example.com/article. Accessed 2024-01-15.',
      );
    });

    it("omits publisher section when publisher is missing", () => {
      const c: RawCitation = { ...fullCitation, publisher: undefined };
      const result = formatCitation(c, "MLA");
      expect(result).not.toContain("Tech Press");
      expect(result).toContain("2023, https://example.com/article");
    });

    it("uses defaults for missing optional fields", () => {
      const result = formatCitation({ id: 1, url: "https://example.com" }, "MLA");
      expect(result).toContain("Unknown Author");
      expect(result).toContain("Untitled");
      expect(result).toContain("n.d.");
    });
  });

  describe("Harvard", () => {
    it("formats a full citation", () => {
      const result = formatCitation(fullCitation, "Harvard");
      expect(result).toBe(
        "Smith, J. (2023) Quantum Computing Overview. Tech Press. Available at: https://example.com/article [Accessed: 2024-01-15].",
      );
    });

    it("omits publisher section when publisher is missing", () => {
      const c: RawCitation = { ...fullCitation, publisher: undefined };
      const result = formatCitation(c, "Harvard");
      expect(result).not.toContain("Tech Press");
      expect(result).toContain("Available at:");
    });

    it("uses defaults for missing optional fields", () => {
      const result = formatCitation({ id: 1, url: "https://example.com" }, "Harvard");
      expect(result).toContain("Unknown Author");
      expect(result).toContain("Untitled");
      expect(result).toContain("n.d.");
    });
  });
});

describe("buildBibliographyFromUrls", () => {
  const urls = [
    "https://example.com/article1",
    "https://example.com/article2",
  ];

  it("builds bibliography entries with sequential ids", () => {
    const result = buildBibliographyFromUrls(urls, "APA", "2024-01-15");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("sets verified to false on all entries", () => {
    const result = buildBibliographyFromUrls(urls, "APA", "2024-01-15");
    expect(result.every((e) => e.verified === false)).toBe(true);
  });

  it("sets the correct url on each entry", () => {
    const result = buildBibliographyFromUrls(urls, "MLA", "2024-01-15");
    expect(result[0].url).toBe(urls[0]);
    expect(result[1].url).toBe(urls[1]);
  });

  it("uses the provided accessDate", () => {
    const result = buildBibliographyFromUrls(urls, "Harvard", "2024-06-01");
    expect(result[0].accessDate).toBe("2024-06-01");
  });

  it("defaults accessDate to today when not provided", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = buildBibliographyFromUrls(urls, "APA");
    expect(result[0].accessDate).toBe(today);
  });

  it("returns empty array for empty input", () => {
    const result = buildBibliographyFromUrls([], "APA", "2024-01-15");
    expect(result).toEqual([]);
  });

  it("formats citations in APA style", () => {
    const result = buildBibliographyFromUrls(["https://example.com"], "APA", "2024-01-15");
    expect(result[0].formattedCitation).toContain("Unknown Author");
    expect(result[0].formattedCitation).toContain("Retrieved 2024-01-15");
  });

  it("formats citations in MLA style", () => {
    const result = buildBibliographyFromUrls(["https://example.com"], "MLA", "2024-01-15");
    expect(result[0].formattedCitation).toContain("Accessed 2024-01-15");
  });

  it("formats citations in Harvard style", () => {
    const result = buildBibliographyFromUrls(["https://example.com"], "Harvard", "2024-01-15");
    expect(result[0].formattedCitation).toContain("Available at:");
    expect(result[0].formattedCitation).toContain("[Accessed: 2024-01-15]");
  });
});
