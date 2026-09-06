import { PDFDocument } from 'pdf-lib';

import { ValidationError } from '../../../utils/errors';
import { PageCountResult } from './types';

// Also acts as the "parser/decoder validation" layer for PDFs: pdf-lib has
// to actually walk the document structure to report a page count, so a
// corrupted or non-PDF file that slipped past the earlier signature check
// will fail here.
//
// (An earlier version of this processor used `pdf-parse`, but its bundled
// pdf.js build has a documented `module.parent`-triggered debug self-test
// that runs a concurrent, unawaited parse under Jest's module system,
// corrupting shared internal state and producing spurious "bad XRef entry"
// failures on perfectly valid PDFs. pdf-lib has no such issue and is
// actively maintained.)
export async function extractPdfPageCount(buffer: Buffer): Promise<PageCountResult> {
  let pageCount: number;
  try {
    // pdf-lib's loader is deliberately lenient (it accepts mildly malformed
    // PDFs many real-world producers emit), so a genuinely broken file may
    // still "load" successfully - the actual structural walk happens when
    // reading pages, which is why getPageCount() is inside this try too.
    const document = await PDFDocument.load(buffer, { updateMetadata: false });
    pageCount = document.getPageCount();
  } catch {
    throw new ValidationError('The uploaded file is not a valid or readable PDF');
  }

  if (pageCount < 1) {
    throw new ValidationError('Unable to determine the PDF page count');
  }

  return { pageCount };
}
