import { z } from "zod/v4";

export const DepthSchema = z.enum(["brief", "deep"]);
export type Depth = z.infer<typeof DepthSchema>;

export const CitationFormatSchema = z.enum(["APA", "MLA", "Harvard"]);
export type CitationFormat = z.infer<typeof CitationFormatSchema>;

export const ResearchInputSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  query: z
    .string()
    .min(1, "Query is required")
    .max(2000, "Query must be 2000 characters or fewer"),
  depth: DepthSchema.default("deep"),
  citationFormat: CitationFormatSchema.default("APA"),
  language: z
    .string()
    .min(2)
    .max(10)
    .default("en")
    .describe("ISO 639-1 language code"),
});

export type ResearchInput = z.infer<typeof ResearchInputSchema>;
