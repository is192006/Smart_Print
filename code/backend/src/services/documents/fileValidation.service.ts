import path from 'node:path';

import {
  ALL_ALLOWED_EXTENSIONS,
  DocumentFileType,
  findDocumentTypeByExtension,
} from '../../config/documentTypes';
import { ValidationError } from '../../utils/errors';

export interface ValidatedFile {
  fileType: DocumentFileType;
  mimeType: string;
  extension: string;
}

// Layered validation:
//   A. extension check
//   B. client-declared MIME-type check (never trusted alone)
//   C. magic-byte/signature check against the file's actual bytes
//   D. parser/decoder validation - performed immediately after this, in the
//      matching document processor (pdf-parse / image-size / adm-zip
//      structural checks), since it doubles as page-count extraction.
//
// A content-sniffing library (`file-type`) was deliberately NOT added here:
// the only CJS-compatible release line (v16.x) carries a live, unpatched
// "infinite loop on malformed input" DoS advisory, and the patched release
// line (v17+) is ESM-only, which this project's Jest/ts-jest CommonJS
// toolchain cannot load (its own ESM `import` statements fail to parse
// under Jest's module system even via dynamic import()). Since PDF/JPG/PNG
// each have an unambiguous magic-byte signature, and DOCX/XLSX/PPTX (which
// all share the outer ZIP signature) are conclusively disambiguated by
// requiring their specific internal part (word/document.xml,
// xl/workbook.xml, ppt/presentation.xml - see the processors) rather than a
// third-party heuristic, this combination provides equivalent real-world
// coverage without that dependency. Legacy CFB formats (.doc/.xls/.ppt)
// share one outer signature that cannot be reliably split further without a
// full OLE parser, which no CJS/TypeScript-compatible library here provides
// either - see legacyOffice.processor.ts.
//
// Rejects as soon as any layer disagrees with the claimed type, so a
// malicious executable renamed to "assignment.pdf" is caught here before it
// ever reaches a parser or the filesystem.
export async function validateUploadedFile(
  buffer: Buffer,
  originalName: string,
  declaredMimeType: string,
): Promise<ValidatedFile> {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('Uploaded file is empty');
  }

  // A. Extension validation.
  const extension = path.extname(originalName).toLowerCase();
  const definition = findDocumentTypeByExtension(extension);
  if (!definition) {
    throw new ValidationError(
      `Unsupported file extension "${extension || '(none)'}". Allowed: ${ALL_ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }

  // B. MIME-type validation (client-declared, never trusted alone).
  if (!definition.mimeTypes.includes(declaredMimeType)) {
    throw new ValidationError(
      `The declared content type "${declaredMimeType}" does not match the "${extension}" extension`,
    );
  }

  // C. Magic-byte/signature validation.
  const matchesSignature = definition.magicBytes.some((signature) =>
    buffer.subarray(0, signature.length).equals(signature),
  );
  if (!matchesSignature) {
    throw new ValidationError(
      'The file content does not match its extension (failed file-signature check)',
    );
  }

  return {
    fileType: definition.fileType,
    mimeType: declaredMimeType,
    extension: definition.extensions[0],
  };
}
