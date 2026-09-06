import { randomUUID } from 'node:crypto';

// `extension` must already be a validated, known-good extension (e.g. from
// DocumentTypeDefinition.extensions[0]) - never derived from raw user input.
// The UUID makes the storage key collision-resistant and unpredictable, and
// since it never incorporates the original filename there is no path to
// exploit for path traversal.
export function generateStorageKey(extension: string): string {
  return `${randomUUID()}${extension}`;
}

// Strips any path component and control characters from a client-supplied
// filename before it is stored as metadata. This filename is never used to
// build a filesystem path - it is display-only.
export function sanitizeOriginalFileName(originalName: string): string {
  const withoutPath = originalName.replace(/^.*[\\/]/, '');
  const withoutControlChars = Array.from(withoutPath)
    .filter((ch) => ch.charCodeAt(0) > 31)
    .join('')
    .trim();
  const truncated = withoutControlChars.slice(0, 255);
  return truncated || 'document';
}
