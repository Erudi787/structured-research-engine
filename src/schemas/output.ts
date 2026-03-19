import { z } from "zod/v4";

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const KeyFindingSchema = z.object({
  id: z.number().int().positive(),
  finding: z.string().min(1),
  confidence: ConfidenceSchema,
  sourceIds: z.array(z.number().int().positive()),
});

export const BibliographyEntrySchema = z.object({
  id: z.number().int().positive(),
  formattedCitation: z.string().min(1),
  url: z.string().url(),
  accessDate: z.string(),
  verified: z.boolean().default(false),
});

export const TechnicalAnalysisSchema = z.object({
  methodology: z.string().min(1),
  details: z.string().min(1),
  limitations: z.string().min(1),
});

export const ValidationSchema = z.object({
  totalCitations: z.number().int().nonnegative(),
  verifiedCitations: z.number().int().nonnegative(),
  unmatchedClaims: z.array(z.string()),
});

export const ResearchMetaSchema = z.object({
  title: z.string(),
  generatedAt: z.string(),
  depth: z.enum(["brief", "deep"]),
  citationFormat: z.enum(["APA", "MLA", "Harvard"]),
  language: z.string(),
  model: z.string(),
});

export const ResearchOutputSchema = z.object({
  meta: ResearchMetaSchema,
  executiveSummary: z.string().min(1),
  keyFindings: z.array(KeyFindingSchema).min(1),
  technicalAnalysis: TechnicalAnalysisSchema,
  bibliography: z.array(BibliographyEntrySchema),
  validation: ValidationSchema,
});

export type KeyFinding = z.infer<typeof KeyFindingSchema>;
export type BibliographyEntry = z.infer<typeof BibliographyEntrySchema>;
export type TechnicalAnalysis = z.infer<typeof TechnicalAnalysisSchema>;
export type Validation = z.infer<typeof ValidationSchema>;
export type ResearchMeta = z.infer<typeof ResearchMetaSchema>;
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
