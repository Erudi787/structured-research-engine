import type { CitationFormat } from "../schemas/input.js";
import type { BibliographyEntry } from "../schemas/output.js";

export interface RawCitation {
  id: number;
  url: string;
  title?: string;
  author?: string;
  year?: string | number;
  publisher?: string;
  accessDate?: string;
}

function formatAPA(c: RawCitation): string {
  const author = c.author ?? "Unknown Author";
  const year = c.year ?? "n.d.";
  const title = c.title ?? "Untitled";
  const accessed = c.accessDate ?? new Date().toISOString().split("T")[0];
  return `${author}. (${year}). ${title}. Retrieved ${accessed}, from ${c.url}`;
}

function formatMLA(c: RawCitation): string {
  const author = c.author ?? "Unknown Author";
  const title = c.title ?? "Untitled";
  const publisher = c.publisher ? `${c.publisher}, ` : "";
  const year = c.year ?? "n.d.";
  const accessed = c.accessDate ?? new Date().toISOString().split("T")[0];
  return `${author}. "${title}." ${publisher}${year}, ${c.url}. Accessed ${accessed}.`;
}

function formatHarvard(c: RawCitation): string {
  const author = c.author ?? "Unknown Author";
  const year = c.year ?? "n.d.";
  const title = c.title ?? "Untitled";
  const publisher = c.publisher ? `${c.publisher}. ` : "";
  const accessed = c.accessDate ?? new Date().toISOString().split("T")[0];
  return `${author} (${year}) ${title}. ${publisher}Available at: ${c.url} [Accessed: ${accessed}].`;
}

export function formatCitation(citation: RawCitation, format: CitationFormat): string {
  switch (format) {
    case "APA":
      return formatAPA(citation);
    case "MLA":
      return formatMLA(citation);
    case "Harvard":
      return formatHarvard(citation);
  }
}

/**
 * Convert a list of raw URLs (e.g. from Perplexity's citations array) into
 * BibliographyEntry objects with formatted citation strings.
 */
export function buildBibliographyFromUrls(
  urls: string[],
  format: CitationFormat,
  accessDate: string = new Date().toISOString().split("T")[0],
): BibliographyEntry[] {
  return urls.map((url, index) => {
    const raw: RawCitation = { id: index + 1, url, accessDate };
    return {
      id: index + 1,
      formattedCitation: formatCitation(raw, format),
      url,
      accessDate,
      verified: false,
    };
  });
}
