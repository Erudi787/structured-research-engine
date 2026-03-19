import { describe, it, expect } from "vitest";
import { buildQuery } from "../core/query-builder.js";
import type { ResearchInput } from "../schemas/input.js";

const baseInput: ResearchInput = {
  title: "Test Research",
  query: "What are the effects of sleep deprivation on cognitive performance?",
  depth: "deep",
  citationFormat: "APA",
  language: "en",
};

describe("buildQuery", () => {
  it("returns sonar-reasoning-pro for deep depth", () => {
    const result = buildQuery({ ...baseInput, depth: "deep" });
    expect(result.model).toBe("sonar-reasoning-pro");
  });

  it("returns sonar-pro for brief depth", () => {
    const result = buildQuery({ ...baseInput, depth: "brief" });
    expect(result.model).toBe("sonar-pro");
  });

  it("includes the research title in the user prompt", () => {
    const result = buildQuery(baseInput);
    expect(result.userPrompt).toContain("Test Research");
  });

  it("includes the query text in the user prompt", () => {
    const result = buildQuery(baseInput);
    expect(result.userPrompt).toContain(baseInput.query);
  });

  it("includes deep word count guidance for deep mode", () => {
    const result = buildQuery({ ...baseInput, depth: "deep" });
    expect(result.userPrompt).toContain("2000");
  });

  it("includes brief word count guidance for brief mode", () => {
    const result = buildQuery({ ...baseInput, depth: "brief" });
    expect(result.userPrompt).toContain("500");
  });

  it("includes APA citation format instruction", () => {
    const result = buildQuery({ ...baseInput, citationFormat: "APA" });
    expect(result.userPrompt).toContain("APA");
  });

  it("includes MLA citation format instruction", () => {
    const result = buildQuery({ ...baseInput, citationFormat: "MLA" });
    expect(result.userPrompt).toContain("MLA");
  });

  it("includes Harvard citation format instruction", () => {
    const result = buildQuery({ ...baseInput, citationFormat: "Harvard" });
    expect(result.userPrompt).toContain("Harvard");
  });

  it("includes language instruction in user prompt", () => {
    const result = buildQuery({ ...baseInput, language: "fr" });
    expect(result.userPrompt).toContain('"fr"');
  });

  it("sets meta.model instruction to match selected model", () => {
    const deepResult = buildQuery({ ...baseInput, depth: "deep" });
    expect(deepResult.userPrompt).toContain("sonar-reasoning-pro");

    const briefResult = buildQuery({ ...baseInput, depth: "brief" });
    expect(briefResult.userPrompt).toContain("sonar-pro");
  });

  it("system prompt instructs JSON output in a code fence", () => {
    const result = buildQuery(baseInput);
    expect(result.systemPrompt).toContain("```json");
  });

  it("system prompt describes the required JSON structure", () => {
    const result = buildQuery(baseInput);
    expect(result.systemPrompt).toContain("executiveSummary");
    expect(result.systemPrompt).toContain("keyFindings");
    expect(result.systemPrompt).toContain("technicalAnalysis");
    expect(result.systemPrompt).toContain("bibliography");
    expect(result.systemPrompt).toContain("validation");
  });

  it("escapes double quotes in the title", () => {
    const result = buildQuery({ ...baseInput, title: 'Title with "quotes"' });
    expect(result.userPrompt).toContain('\\"quotes\\"');
  });
});
