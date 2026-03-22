// Public API re-exports
export { ResearchInputSchema, type ResearchInput } from "./schemas/input.js";
export { ResearchOutputSchema, type ResearchOutput } from "./schemas/output.js";
export { loadConfig } from "./utils/config.js";
export { RateLimiter } from "./utils/rate-limiter.js";
export { buildQuery, type QueryBuilderResult } from "./core/query-builder.js";
export { callPerplexity, createPerplexityClient, type PerplexityResponse } from "./core/perplexity.js";
export { parsePerplexityResponse, isParseError, type ParseResult, type ParseError } from "./core/parser.js";
export { formatCitation, buildBibliographyFromUrls, type RawCitation } from "./formatters/citations.js";
export { formatPretty } from "./formatters/pretty.js";

// ─── CLI ─────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { ResearchInputSchema } from "./schemas/input.js";
import { loadConfig } from "./utils/config.js";
import { RateLimiter } from "./utils/rate-limiter.js";
import { buildQuery } from "./core/query-builder.js";
import { callPerplexity, createPerplexityClient } from "./core/perplexity.js";
import { parsePerplexityResponse, isParseError } from "./core/parser.js";
import { formatPretty } from "./formatters/pretty.js";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(
      [
        "",
        "Usage: npx tsx src/index.ts [options]",
        "",
        "Options:",
        "  --title   <string>           Research title (required)",
        "  --query   <string>           Research query (required)",
        "  --depth   brief|deep         Analysis depth (default: deep)",
        "  --format  APA|MLA|Harvard    Citation format (default: APA)",
        "  --lang    <ISO 639-1 code>   Output language (default: en)",
        "  --output  json|pretty        Display mode (default: json)",
        "  --help                       Show this help",
        "",
        "Output is always written to output/<timestamp>-<title-slug>.json",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  // Validate input
  const inputResult = ResearchInputSchema.safeParse({
    title: args.title,
    query: args.query,
    depth: args.depth,
    citationFormat: args.format,
    language: args.lang,
  });

  if (!inputResult.success) {
    const issues = inputResult.error.issues
      .map((i) => `  - ${i.path.join(".") || "field"}: ${i.message}`)
      .join("\n");
    console.error(`\nInvalid arguments:\n${issues}\n\nRun with --help for usage.\n`);
    process.exit(1);
  }

  const input = inputResult.data;
  const outputMode = args.output === "pretty" ? "pretty" : "json";

  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
  }

  console.error(`\nResearching: "${input.title}" (depth: ${input.depth})\n`);

  // Run pipeline
  const client = createPerplexityClient(config.perplexityApiKey);
  const rateLimiter = new RateLimiter(config.rateLimitRpm);
  const query = buildQuery(input);

  let apiResponse;
  try {
    apiResponse = await callPerplexity(query, rateLimiter, client);
  } catch (err) {
    console.error(`\nAPI error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  console.error(`Model used: ${apiResponse.model}\n`);

  const parsed = parsePerplexityResponse(apiResponse, input);

  if (isParseError(parsed)) {
    console.error(`\nParse error: ${parsed.error}\n`);
    console.error("Raw response saved to output/parse-error.txt");
    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync("output/parse-error.txt", parsed.rawContent, "utf8");
    process.exit(1);
  }

  if (parsed.parseWarnings.length > 0) {
    for (const w of parsed.parseWarnings) {
      console.error(`Warning: ${w}`);
    }
  }

  // Write JSON to output/
  fs.mkdirSync("output", { recursive: true });
  const filename = `${formatTimestamp()}-${slugify(input.title)}.json`;
  const filepath = path.join("output", filename);
  fs.writeFileSync(filepath, JSON.stringify(parsed.output, null, 2), "utf8");
  console.error(`\nSaved to: ${filepath}\n`);

  // Display
  if (outputMode === "pretty") {
    process.stdout.write(formatPretty(parsed.output));
  } else {
    process.stdout.write(JSON.stringify(parsed.output, null, 2) + "\n");
  }
}

// Run CLI only when executed directly
if (require.main === module) {
  runCli().catch((err: Error) => {
    console.error(`\nUnexpected error: ${err.message}\n`);
    process.exit(1);
  });
}
