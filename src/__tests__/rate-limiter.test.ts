import { describe, it, expect } from "vitest";
import { RateLimiter } from "../utils/rate-limiter.js";

describe("RateLimiter", () => {
  it("starts with full token bucket", () => {
    const limiter = new RateLimiter(10);
    expect(limiter.available).toBe(10);
  });

  it("decrements tokens on acquire", async () => {
    const limiter = new RateLimiter(10);
    await limiter.acquire();
    expect(limiter.available).toBe(9);
  });

  it("allows burst up to max tokens", async () => {
    const limiter = new RateLimiter(5);
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    expect(limiter.available).toBe(0);
  });

  it("refills tokens over time", async () => {
    const limiter = new RateLimiter(60); // 1 per second
    // Drain all tokens
    for (let i = 0; i < 60; i++) {
      await limiter.acquire();
    }
    expect(limiter.available).toBe(0);

    // Wait 100ms -> should refill ~1 token (60 per 60000ms = 1 per 1000ms)
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(limiter.available).toBeGreaterThanOrEqual(1);
  });
});

describe("RateLimiter - config", () => {
  it("accepts various RPM values", () => {
    const limiter1 = new RateLimiter(1);
    expect(limiter1.available).toBe(1);

    const limiter100 = new RateLimiter(100);
    expect(limiter100.available).toBe(100);
  });
});
