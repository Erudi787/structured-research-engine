import { ResearchOutputSchema, type ResearchOutput } from "../schemas/output.js";
import type { ResearchInput } from "../schemas/input.js";
import type { PerplexityResponse } from "./perplexity.js";

export interface ParseResult {
  output: ResearchOutput;
  parseWarnings: string[];
}

export interface ParseError {
  error: string;
  rawContent: string;
}

function extractJsonString(content: string): string | null {
  // Try markdown code fence: ```json ... ``` or ``` ... ```
  const codeFenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeFenceMatch) {
    return codeFenceMatch[1].trim();
  }

  // Fall back to finding a raw JSON object
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function attemptJsonRepair(jsonStr: string): string {
  let repaired = jsonStr.trimEnd();

  // Remove trailing comma before attempting to close structures
  repaired = repaired.replace(/,\s*$/, "");

  // Close any unclosed arrays then objects (order matters)
  const openArrays = (repaired.match(/\[/g) ?? []).length;
  const closeArrays = (repaired.match(/\]/g) ?? []).length;
  const openObjects = (repaired.match(/\{/g) ?? []).length;
  const closeObjects = (repaired.match(/\}/g) ?? []).length;

  for (let i = 0; i < openArrays - closeArrays; i++) repaired += "]";
  for (let i = 0; i < openObjects - closeObjects; i++) repaired += "}";

  return repaired;
}

export function parsePerplexityResponse(
  response: PerplexityResponse,
  input: ResearchInput,
): ParseResult | ParseError {
  const warnings: string[] = [];

  // Step 1: Extract JSON string from content
  const jsonStr = extractJsonString(response.content);
  if (!jsonStr) {
    return { error: "No JSON object found in response", rawContent: response.content };
  }

  // Step 2: Parse — repair if needed
  let rawData: unknown;
  try {
    rawData = JSON.parse(jsonStr);
  } catch {
    warnings.push("JSON was malformed; attempting repair");
    const repaired = attemptJsonRepair(jsonStr);
    try {
      rawData = JSON.parse(repaired);
    } catch {
      return {
        error: "Failed to parse JSON even after repair attempt",
        rawContent: response.content,
      };
    }
  }

  // Step 3: Fill defaults for known missing/incomplete fields
  if (typeof rawData === "object" && rawData !== null) {
    const data = rawData as Record<string, unknown>;

    if (!data.meta || typeof data.meta !== "object") {
      data.meta = {};
      warnings.push("meta block was missing; filled with defaults");
    }
    const meta = data.meta as Record<string, unknown>;
    if (!meta.title) meta.title = input.title;
    if (!meta.generatedAt) meta.generatedAt = new Date().toISOString();
    if (!meta.depth) meta.depth = input.depth;
    if (!meta.citationFormat) meta.citationFormat = input.citationFormat;
    if (!meta.language) meta.language = input.language;
    if (!meta.model) meta.model = response.model;

    if (!data.validation || typeof data.validation !== "object") {
      data.validation = {
        totalCitations: Array.isArray(data.bibliography)
          ? (data.bibliography as unknown[]).length
          : 0,
        verifiedCitations: 0,
        unmatchedClaims: [],
      };
      warnings.push("validation block was missing; filled with defaults");
    }

    const today = new Date().toISOString().split("T")[0];
    if (Array.isArray(data.bibliography)) {
      for (const entry of data.bibliography as Record<string, unknown>[]) {
        if (!entry.accessDate) {
          entry.accessDate = today;
          warnings.push(`Bibliography entry ${entry.id}: accessDate was missing; defaulted to today`);
        }
        if (entry.verified === undefined) {
          entry.verified = false;
        }
      }
    }
  }

  // Step 4: Validate against schema
  const result = ResearchOutputSchema.safeParse(rawData);
  if (!result.success) {
    return {
      error: `Schema validation failed: ${JSON.stringify(result.error.issues)}`,
      rawContent: response.content,
    };
  }

  return { output: result.data, parseWarnings: warnings };
}

export function isParseError(result: ParseResult | ParseError): result is ParseError {
  return "error" in result;
}
