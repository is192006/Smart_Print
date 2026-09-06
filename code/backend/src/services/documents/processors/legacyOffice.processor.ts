import { PageCountResult } from './types';

// .doc/.xls/.ppt are the legacy OLE Compound File Binary format, not ZIP/XML
// like their OOXML successors. Reliably parsing that format (let alone
// deriving a page/slide count from it) requires a full CFB directory-stream
// parser; no well-maintained, TypeScript-compatible package for this
// currently exists in the Node ecosystem, and pretending an OOXML parser
// can read it would be dishonest. The magic-byte + file-type signature
// check (see fileValidation.service.ts) already confirms the upload really
// is a compound-file document before this processor is reached, so the
// file is still accepted and stored - only its page count is left unknown.
export async function extractLegacyOfficePageCount(): Promise<PageCountResult> {
  return {
    pageCount: null,
    note:
      'Automatic page-count extraction is not supported for legacy binary Office formats ' +
      '(.doc/.xls/.ppt) in this phase. Reliable parsing would require a full OLE/Compound-File-' +
      'Binary-Format parser; converting the file to its OOXML equivalent is the practical workaround.',
  };
}
