/**
 * Token-bucket rate limiter.
 * Allows `maxTokens` requests per `intervalMs` window.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly intervalMs: number;

  constructor(maxRequestsPerMinute: number) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.intervalMs = 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.intervalMs) * this.maxTokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until at least 1 token is available
    const waitMs = ((1 - this.tokens) / this.maxTokens) * this.intervalMs;
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
    this.refill();
    this.tokens -= 1;
  }

  /** Current number of available tokens (for testing). */
  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
