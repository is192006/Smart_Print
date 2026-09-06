import { ValidationError } from './errors';

export interface ResolvedPageRange {
  // The original string as submitted, trimmed - null means "entire
  // document". Stored verbatim on OrderDocument for display/audit.
  pageRangeString: string | null;
  // Distinct page count after resolving the range (or the whole document).
  selectedPageCount: number;
}

const SINGLE_PAGE_TOKEN = /^\d+$/;
const RANGE_TOKEN = /^(\d+)-(\d+)$/;

// Parses page-range syntax such as "1-5", "3,5,7", "1-5,8,10-12". Overlapping
// pages are de-duplicated (e.g. "1-5,3" selects 5 distinct pages, not 6).
// When `knownPageCount` is available, every page number is bounds-checked
// against it; when it is null (Document.pageCount unknown), that specific
// check is skipped rather than fabricated, but syntax/positivity are still
// enforced.
export function resolvePageRange(
  pageRangeInput: unknown,
  knownPageCount: number | null,
): ResolvedPageRange {
  if (pageRangeInput === undefined || pageRangeInput === null || pageRangeInput === '') {
    if (knownPageCount === null) {
      throw new ValidationError(
        'This document has an unknown page count, so a pageRange must be specified explicitly',
      );
    }
    return { pageRangeString: null, selectedPageCount: knownPageCount };
  }

  if (typeof pageRangeInput !== 'string') {
    throw new ValidationError('pageRange must be a string');
  }

  const trimmed = pageRangeInput.trim();
  if (trimmed.length === 0) {
    if (knownPageCount === null) {
      throw new ValidationError(
        'This document has an unknown page count, so a pageRange must be specified explicitly',
      );
    }
    return { pageRangeString: null, selectedPageCount: knownPageCount };
  }

  const tokens = trimmed.split(',').map((t) => t.trim());
  const pages = new Set<number>();

  for (const token of tokens) {
    if (token.length === 0) {
      throw new ValidationError(`Malformed pageRange: "${trimmed}"`);
    }

    const singleMatch = SINGLE_PAGE_TOKEN.exec(token);
    if (singleMatch) {
      const page = Number(token);
      if (page < 1) {
        throw new ValidationError(`Malformed pageRange: page numbers must be >= 1 (got ${page})`);
      }
      pages.add(page);
      continue;
    }

    const rangeMatch = RANGE_TOKEN.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1) {
        throw new ValidationError(
          `Malformed pageRange: page numbers must be >= 1 (got "${token}")`,
        );
      }
      if (start > end) {
        throw new ValidationError(
          `Malformed pageRange: range start must be <= end (got "${token}")`,
        );
      }
      for (let page = start; page <= end; page += 1) {
        pages.add(page);
      }
      continue;
    }

    throw new ValidationError(`Malformed pageRange: "${token}"`);
  }

  if (pages.size === 0) {
    throw new ValidationError(`Malformed pageRange: "${trimmed}"`);
  }

  if (knownPageCount !== null) {
    const maxRequested = Math.max(...pages);
    if (maxRequested > knownPageCount) {
      throw new ValidationError(
        `pageRange requests page ${maxRequested}, but the document only has ${knownPageCount} page(s)`,
      );
    }
  }

  return { pageRangeString: trimmed, selectedPageCount: pages.size };
}
