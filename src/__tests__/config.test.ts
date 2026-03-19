import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when PERPLEXITY_API_KEY is missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const { loadConfig } = await import("../utils/config.js");
    expect(() => loadConfig()).toThrow("PERPLEXITY_API_KEY is required");
  });

  it("loads config when API key is present", async () => {
    process.env.PERPLEXITY_API_KEY = "pplx-test-key-123";
    const { loadConfig } = await import("../utils/config.js");
    const config = loadConfig();
    expect(config.perplexityApiKey).toBe("pplx-test-key-123");
    expect(config.rateLimitRpm).toBe(50);
  });

  it("respects custom RATE_LIMIT_RPM", async () => {
    process.env.PERPLEXITY_API_KEY = "pplx-test-key-123";
    process.env.RATE_LIMIT_RPM = "100";
    const { loadConfig } = await import("../utils/config.js");
    const config = loadConfig();
    expect(config.rateLimitRpm).toBe(100);
  });
});
