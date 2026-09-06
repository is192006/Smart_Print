import AdmZip from 'adm-zip';

import { ValidationError } from '../../../utils/errors';
import { PageCountResult } from './types';

// XLSX is a ZIP of XML parts; confirming that structure is this format's
// parser/decoder validation layer.
//
// Deliberately does NOT report worksheet count as "page count" - a
// worksheet's actual number of printed pages depends on print area, page
// breaks, scaling, and paper size, none of which are computable without
// rendering the sheet. Excel does not reliably cache a printable page count
// in docProps/app.xml the way Word does for documents. Until a rendering
// step is available, page count for XLSX is intentionally left unknown.
export async function extractXlsxPageCount(buffer: Buffer): Promise<PageCountResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ValidationError('The uploaded file is not a valid XLSX (Office Open XML) workbook');
  }

  const workbookEntry = zip.getEntry('xl/workbook.xml');
  const contentTypesEntry = zip.getEntry('[Content_Types].xml');
  if (!workbookEntry || !contentTypesEntry) {
    throw new ValidationError('The uploaded file is not a valid XLSX (Office Open XML) workbook');
  }

  return {
    pageCount: null,
    note:
      "XLSX printable page count is not determined: it depends on each sheet's print area, " +
      'page breaks, and scaling, none of which can be reliably computed without rendering.',
  };
}
