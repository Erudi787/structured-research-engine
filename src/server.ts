import Fastify, { type FastifyInstance } from "fastify";
import { ResearchInputSchema, type ResearchInput } from "./schemas/input.js";
import type { Config } from "./utils/config.js";
import type { RateLimiter } from "./utils/rate-limiter.js";
import type { QueryBuilderResult } from "./core/query-builder.js";
import type { PerplexityResponse } from "./core/perplexity.js";
import type { ParseResult, ParseError } from "./core/parser.js";
import type { VerificationResult } from "./core/validator.js";

// ── Dependency types ──────────────────────────────────────────────────────────

export interface ServerDeps {
  loadConfig: () => Config;
  createRateLimiter: (rpm: number) => RateLimiter;
  createClient: (apiKey: string) => unknown;
  buildQuery: (input: ResearchInput) => QueryBuilderResult;
  callPerplexity: (
    query: QueryBuilderResult,
    limiter: RateLimiter,
    client: unknown,
  ) => Promise<PerplexityResponse>;
  parseResponse: (
    response: PerplexityResponse,
    input: ResearchInput,
  ) => ParseResult | ParseError;
  isParseError: (result: ParseResult | ParseError) => result is ParseError;
  verifyCitations: (output: ParseResult["output"]) => Promise<VerificationResult>;
}

// ── Default production dependencies ──────────────────────────────────────────

function buildDefaultDeps(): ServerDeps {
  // Lazy-loaded so the server file can be imported without side effects
  const { loadConfig } = require("./utils/config.js") as typeof import("./utils/config.js");
  const { RateLimiter } = require("./utils/rate-limiter.js") as typeof import("./utils/rate-limiter.js");
  const { buildQuery } = require("./core/query-builder.js") as typeof import("./core/query-builder.js");
  const { callPerplexity, createPerplexityClient } = require("./core/perplexity.js") as typeof import("./core/perplexity.js");
  const { parsePerplexityResponse, isParseError } = require("./core/parser.js") as typeof import("./core/parser.js");
  const { verifyCitations } = require("./core/validator.js") as typeof import("./core/validator.js");

  return {
    loadConfig,
    createRateLimiter: (rpm) => new RateLimiter(rpm),
    createClient: (apiKey) => createPerplexityClient(apiKey),
    buildQuery,
    callPerplexity,
    parseResponse: parsePerplexityResponse,
    isParseError,
    verifyCitations,
  };
}

// ── Server factory ────────────────────────────────────────────────────────────

export function createServer(
  opts: { logger?: boolean } = {},
  deps?: ServerDeps,
): FastifyInstance {
  const d = deps ?? buildDefaultDeps();
  const fastify = Fastify({ logger: opts.logger ?? false });

  fastify.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });

  fastify.post("/research", async (request, reply) => {
    // Validate request body
    const inputResult = ResearchInputSchema.safeParse(request.body);
    if (!inputResult.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        issues: inputResult.error.issues,
      });
    }

    const input = inputResult.data;

    // Load config
    let config: Config;
    try {
      config = d.loadConfig();
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }

    // Build query and call Perplexity
    const client = d.createClient(config.perplexityApiKey);
    const rateLimiter = d.createRateLimiter(config.rateLimitRpm);
    const query = d.buildQuery(input);

    let apiResponse: PerplexityResponse;
    try {
      apiResponse = await d.callPerplexity(query, rateLimiter, client);
    } catch (err) {
      return reply.status(502).send({
        error: `Perplexity API error: ${(err as Error).message}`,
      });
    }

    // Parse response
    const parseResult = d.parseResponse(apiResponse, input);
    if (d.isParseError(parseResult)) {
      return reply.status(500).send({ error: `Parse error: ${parseResult.error}` });
    }

    // Verify citations
    const { output, verificationWarnings } = await d.verifyCitations(parseResult.output);

    return reply.status(200).send({
      data: output,
      warnings: [...parseResult.parseWarnings, ...verificationWarnings],
    });
  });

  return fastify;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const server = createServer({ logger: true });
  server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
