import type { ResearchInput } from "../schemas/input.js";

const MODEL_MAP = {
  deep: "sonar-reasoning-pro",
  brief: "sonar-pro",
} as const;

const DEPTH_INSTRUCTIONS = {
  deep: "Produce a comprehensive, multi-paragraph analysis of approximately 2000 words or more. Cover methodology, nuance, and limitations in depth.",
  brief: "Produce a concise analysis of approximately 500 words. Focus on the most important findings and key takeaways only.",
} as const;

const CITATION_FORMAT_INSTRUCTIONS = {
  APA: 'Format all bibliography entries in APA 7th edition style (e.g., Author, A. A. (Year). Title of work. Publisher. https://doi.org/xxxxx).',
  MLA: 'Format all bibliography entries in MLA 9th edition style (e.g., Author Last, First. "Title." Publisher, Year, URL.).',
  Harvard: 'Format all bibliography entries in Harvard referencing style (e.g., Author (Year) Title, Publisher. Available at: URL [Accessed: date].).',
} as const;

const SYSTEM_PROMPT = `You are a rigorous academic research assistant. Your task is to research the given query and return a structured JSON document.

CRITICAL: Your entire response must be a single valid JSON object wrapped in a markdown code fence (\`\`\`json ... \`\`\`). Do not include any text outside the code fence.

The JSON must match this exact structure:
{
  "meta": {
    "title": "string — the research title",
    "generatedAt": "ISO-8601 datetime string",
    "depth": "brief | deep",
    "citationFormat": "APA | MLA | Harvard",
    "language": "ISO 639-1 code",
    "model": "string — the model name you are"
  },
  "executiveSummary": "string — 1 to 3 paragraphs summarizing the research",
  "keyFindings": [
    {
      "id": 1,
      "finding": "string — a specific, concrete finding",
      "confidence": "high | medium | low",
      "sourceIds": [1, 2]
    }
  ],
  "technicalAnalysis": {
    "methodology": "string — how the research was conducted",
    "details": "string — multi-paragraph in-depth analysis",
    "limitations": "string — known gaps or caveats"
  },
  "bibliography": [
    {
      "id": 1,
      "formattedCitation": "string — formatted in the requested citation style",
      "url": "string — full URL",
      "accessDate": "ISO-8601 date string",
      "verified": false
    }
  ],
  "validation": {
    "totalCitations": 0,
    "verifiedCitations": 0,
    "unmatchedClaims": []
  }
}

Rules:
- Use inline citation markers [1], [2], etc. within executiveSummary, keyFindings, and technicalAnalysis.details to reference bibliography entries.
- Every sourceId in keyFindings must correspond to a valid bibliography entry id.
- keyFindings must contain at least one entry.
- bibliography may be empty if no sources were found, but strive to include as many credible sources as possible.
- Set validation.totalCitations to the count of bibliography entries.
- Set validation.verifiedCitations to 0 (verification happens downstream).
- Set validation.unmatchedClaims to an empty array.
- If you are uncertain about a field, provide a sensible default rather than omitting it.`;

export interface QueryBuilderResult {
  systemPrompt: string;
  userPrompt: string;
  model: string;
}

export function buildQuery(input: ResearchInput): QueryBuilderResult {
  const model = MODEL_MAP[input.depth];

  const userPrompt = [
    `Research Title: ${input.title}`,
    ``,
    `Research Query: ${input.query}`,
    ``,
    `Instructions:`,
    `- ${DEPTH_INSTRUCTIONS[input.depth]}`,
    `- ${CITATION_FORMAT_INSTRUCTIONS[input.citationFormat]}`,
    `- Respond entirely in the language with ISO 639-1 code: "${input.language}".`,
    `- Set meta.depth to "${input.depth}".`,
    `- Set meta.citationFormat to "${input.citationFormat}".`,
    `- Set meta.language to "${input.language}".`,
    `- Set meta.title to "${input.title.replace(/"/g, '\\"')}".`,
    `- Set meta.generatedAt to the current UTC datetime in ISO-8601 format.`,
    `- Set meta.model to "${model}".`,
  ].join("\n");

  return { systemPrompt: SYSTEM_PROMPT, userPrompt, model };
}
