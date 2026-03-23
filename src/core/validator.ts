import type { ResearchOutput, BibliographyEntry } from "../schemas/output.js";

const CITATION_REF_RE = /\[(\d+)\]/g;
const URL_VERIFY_TIMEOUT_MS = 5000;

export interface VerificationResult {
  output: ResearchOutput;
  verificationWarnings: string[];
}

async function isUrlReachable(url: string, timeoutMs = URL_VERIFY_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function extractReferencedIds(text: string): Set<number> {
  const ids = new Set<number>();
  for (const match of text.matchAll(CITATION_REF_RE)) {
    ids.add(parseInt(match[1], 10));
  }
  return ids;
}

function collectTextFields(output: ResearchOutput): string[] {
  return [
    output.executiveSummary,
    output.technicalAnalysis.details,
    ...output.keyFindings.map((f) => f.finding),
  ];
}

function findUnmatchedClaims(
  referencedIds: Set<number>,
  bibliographyIds: Set<number>,
): string[] {
  const unmatched: string[] = [];
  for (const id of referencedIds) {
    if (!bibliographyIds.has(id)) {
      unmatched.push(`[${id}] referenced in text but has no matching bibliography entry`);
    }
  }
  return unmatched.sort();
}

export async function verifyCitations(
  output: ResearchOutput,
  timeoutMs = URL_VERIFY_TIMEOUT_MS,
): Promise<VerificationResult> {
  const warnings: string[] = [];

  // Step 1: Verify each URL with a HEAD request
  const verifiedEntries: BibliographyEntry[] = await Promise.all(
    output.bibliography.map(async (entry) => {
      const reachable = await isUrlReachable(entry.url, timeoutMs);
      if (!reachable) {
        warnings.push(`[${entry.id}] URL unreachable or timed out: ${entry.url}`);
      }
      return { ...entry, verified: reachable };
    }),
  );

  // Step 2: Cross-reference [n] markers across all text fields
  const allText = collectTextFields(output).join(" ");
  const referencedIds = extractReferencedIds(allText);
  const bibliographyIds = new Set(verifiedEntries.map((e) => e.id));
  const unmatchedClaims = findUnmatchedClaims(referencedIds, bibliographyIds);

  if (unmatchedClaims.length > 0) {
    warnings.push(...unmatchedClaims.map((c) => `Unmatched claim: ${c}`));
  }

  const verifiedCount = verifiedEntries.filter((e) => e.verified).length;

  const updatedOutput: ResearchOutput = {
    ...output,
    bibliography: verifiedEntries,
    validation: {
      totalCitations: verifiedEntries.length,
      verifiedCitations: verifiedCount,
      unmatchedClaims,
    },
  };

  return { output: updatedOutput, verificationWarnings: warnings };
}
