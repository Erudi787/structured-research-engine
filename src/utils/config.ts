import dotenv from "dotenv";
import { z } from "zod/v4";

dotenv.config();

const ConfigSchema = z.object({
  perplexityApiKey: z.string().min(1, "PERPLEXITY_API_KEY is required"),
  rateLimitRpm: z.number().int().positive().default(50),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const raw = {
    perplexityApiKey: process.env.PERPLEXITY_API_KEY ?? "",
    rateLimitRpm: parseInt(process.env.RATE_LIMIT_RPM ?? "50", 10) || 50,
  };

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration error:\n${issues}\n\nSee .env.example for required variables.`);
  }

  return result.data;
}
