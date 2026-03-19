import { describe, it, expect, vi, beforeEach } from "vitest";
import { callPerplexity } from "../core/perplexity.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import type { QueryBuilderResult } from "../core/query-builder.js";
import OpenAI from "openai";
import type { Mock } from "vitest";

const mockQuery: QueryBuilderResult = {
  systemPrompt: "You are a research assistant.",
  userPrompt: "Research query here.",
  model: "sonar-reasoning-pro",
};

function makeClient(createFn: Mock) {
  return {
    chat: { completions: { create: createFn } },
  } as unknown as OpenAI;
}

function successResponse(content: string) {
  return Promise.resolve({ choices: [{ message: { content } }] });
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("callPerplexity", () => {
  it("returns content and model on success", async () => {
    const create = vi.fn().mockReturnValue(successResponse("```json\n{}\n```"));
    const result = await callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));

    expect(result.content).toBe("```json\n{}\n```");
    expect(result.model).toBe("sonar-reasoning-pro");
  });

  it("passes the preferred model from the query to the API", async () => {
    const create = vi.fn().mockReturnValue(successResponse("response"));
    await callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "sonar-reasoning-pro" }),
    );
  });

  it("passes system and user prompts to the API", async () => {
    const create = vi.fn().mockReturnValue(successResponse("response"));
    await callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: mockQuery.systemPrompt },
          { role: "user", content: mockQuery.userPrompt },
        ],
      }),
    );
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const rateLimitError = new OpenAI.APIError(429, { message: "rate limit" }, "rate limit", new Headers());
    const create = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockReturnValue(successResponse("ok"));

    const promise = callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("ok");
  });

  it("retries on 500 server error up to max retries then throws", async () => {
    const serverError = new OpenAI.APIError(500, { message: "server error" }, "server error", new Headers());
    const create = vi.fn().mockRejectedValue(serverError);

    const promise = callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));
    promise.catch(() => {}); // suppress unhandled rejection during timer advancement
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(3); // MAX_RETRIES
  });

  it("does not retry on non-retryable 400 error", async () => {
    const badRequest = new OpenAI.APIError(400, { message: "bad request" }, "bad request", new Headers());
    const create = vi.fn().mockRejectedValue(badRequest);

    await expect(
      callPerplexity(mockQuery, new RateLimiter(50), makeClient(create)),
    ).rejects.toThrow();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("falls back to sonar-pro when sonar-reasoning-pro returns 503", async () => {
    const unavailable = new OpenAI.APIError(503, { message: "unavailable" }, "unavailable", new Headers());
    const create = vi
      .fn()
      .mockRejectedValueOnce(unavailable)
      .mockReturnValue(successResponse("fallback response"));

    const result = await callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("fallback response");
  });

  it("falls back through the full chain sonar-reasoning-pro → sonar-pro → sonar", async () => {
    const unavailable = new OpenAI.APIError(503, { message: "unavailable" }, "unavailable", new Headers());
    const create = vi
      .fn()
      .mockRejectedValueOnce(unavailable)
      .mockRejectedValueOnce(unavailable)
      .mockReturnValue(successResponse("final fallback"));

    const result = await callPerplexity(mockQuery, new RateLimiter(50), makeClient(create));

    expect(create).toHaveBeenCalledTimes(3);
    expect(result.content).toBe("final fallback");
  });

  it("throws when all models in the fallback chain are exhausted", async () => {
    const unavailable = new OpenAI.APIError(503, { message: "unavailable" }, "unavailable", new Headers());
    const create = vi.fn().mockRejectedValue(unavailable);

    await expect(
      callPerplexity(mockQuery, new RateLimiter(50), makeClient(create)),
    ).rejects.toThrow();

    expect(create).toHaveBeenCalledTimes(3); // one per model in chain
  });

  it("acquires a rate limiter token before each call", async () => {
    const create = vi.fn().mockReturnValue(successResponse("ok"));
    const limiter = new RateLimiter(50);
    const acquireSpy = vi.spyOn(limiter, "acquire");

    await callPerplexity(mockQuery, limiter, makeClient(create));

    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when the API returns empty content", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: "" } }] });

    await expect(
      callPerplexity(mockQuery, new RateLimiter(50), makeClient(create)),
    ).rejects.toThrow("Empty response");
  });
});
