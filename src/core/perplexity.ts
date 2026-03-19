import OpenAI from "openai";
import type { RateLimiter } from "../utils/rate-limiter.js";
import type { QueryBuilderResult } from "./query-builder.js";

export function createPerplexityClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: "https://api.perplexity.ai" });
}

const FALLBACK_MODELS = ["sonar-reasoning-pro", "sonar-pro", "sonar"] as const;
type PerplexityModel = (typeof FALLBACK_MODELS)[number];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface PerplexityResponse {
  content: string;
  model: string;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // 503/404 are fallbackable — handled by the outer model chain, not retried here
    return error.status === 429 || (error.status >= 500 && !isFallbackable(error));
  }
  return false;
}

function isFallbackable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // Model unavailable or overloaded
    return error.status === 503 || error.status === 404;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Perplexity API");
      }

      return content;
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function callPerplexity(
  query: QueryBuilderResult,
  rateLimiter: RateLimiter,
  client: OpenAI,
): Promise<PerplexityResponse> {

  const modelsToTry: PerplexityModel[] = buildFallbackChain(query.model);

  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      await rateLimiter.acquire();
      const content = await callWithRetry(
        client,
        model,
        query.systemPrompt,
        query.userPrompt,
      );
      return { content, model };
    } catch (error) {
      lastError = error;

      if (isFallbackable(error)) {
        // Try the next model in the fallback chain
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("All models in fallback chain exhausted");
}

function buildFallbackChain(preferredModel: string): PerplexityModel[] {
  const chain: PerplexityModel[] = [];

  // Start with the preferred model if it's a known one
  if (FALLBACK_MODELS.includes(preferredModel as PerplexityModel)) {
    chain.push(preferredModel as PerplexityModel);
  }

  // Append remaining fallbacks in order
  for (const model of FALLBACK_MODELS) {
    if (!chain.includes(model)) {
      chain.push(model);
    }
  }

  return chain;
}
