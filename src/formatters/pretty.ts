import type { ResearchOutput } from "../schemas/output.js";

const B = "\x1b[1m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

function hr(char = "─", width = 80): string {
  return char.repeat(width);
}

function confidenceColor(level: "high" | "medium" | "low"): string {
  if (level === "high") return GREEN;
  if (level === "medium") return YELLOW;
  return DIM;
}

export function formatPretty(doc: ResearchOutput): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(`${B}${CYAN}${hr()}${RESET}`);
  lines.push(`${B}${CYAN}  ${doc.meta.title}${RESET}`);
  lines.push(
    `${DIM}  Generated: ${doc.meta.generatedAt}  |  Model: ${doc.meta.model}  |  Depth: ${doc.meta.depth}  |  Format: ${doc.meta.citationFormat}${RESET}`,
  );
  lines.push(`${B}${CYAN}${hr()}${RESET}`);

  // Executive Summary
  lines.push("");
  lines.push(`${B}EXECUTIVE SUMMARY${RESET}`);
  lines.push(hr("─", 40));
  lines.push(doc.executiveSummary);

  // Key Findings
  lines.push("");
  lines.push(`${B}KEY FINDINGS${RESET}`);
  lines.push(hr("─", 40));
  for (const f of doc.keyFindings) {
    const sources = f.sourceIds.map((id) => `[${id}]`).join(" ");
    const cc = confidenceColor(f.confidence);
    lines.push(`  ${B}${f.id}.${RESET} ${f.finding} ${DIM}${sources}${RESET}`);
    lines.push(`     ${DIM}Confidence: ${cc}${f.confidence}${RESET}`);
  }

  // Technical Analysis
  lines.push("");
  lines.push(`${B}TECHNICAL ANALYSIS${RESET}`);
  lines.push(hr("─", 40));
  lines.push(`${B}Methodology:${RESET} ${doc.technicalAnalysis.methodology}`);
  lines.push("");
  lines.push(doc.technicalAnalysis.details);
  lines.push("");
  lines.push(`${B}Limitations:${RESET} ${doc.technicalAnalysis.limitations}`);

  // Bibliography
  lines.push("");
  lines.push(`${B}BIBLIOGRAPHY${RESET} ${DIM}(${doc.bibliography.length} sources)${RESET}`);
  lines.push(hr("─", 40));
  for (const entry of doc.bibliography) {
    const mark = entry.verified ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
    lines.push(`  ${mark} [${entry.id}] ${entry.formattedCitation}`);
    lines.push(`         ${DIM}${entry.url}${RESET}`);
  }

  // Validation footer
  lines.push("");
  lines.push(
    `${DIM}Validation: ${doc.validation.totalCitations} total citations, ${doc.validation.verifiedCitations} verified${RESET}`,
  );
  if (doc.validation.unmatchedClaims.length > 0) {
    lines.push(`${YELLOW}Unmatched claims: ${doc.validation.unmatchedClaims.join("; ")}${RESET}`);
  }
  lines.push("");

  return lines.join("\n");
}
