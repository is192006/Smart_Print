import AdmZip from 'adm-zip';

import { ValidationError } from '../../../utils/errors';
import { PageCountResult } from './types';

const SLIDE_ENTRY_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;

// One slide = one printable page for SmartPrint's current model. Unlike
// Word/Excel, slide count is exact and directly countable from the ZIP
// structure - each slide is genuinely a separate part - so no caveat is
// needed here.
export async function extractPptxPageCount(buffer: Buffer): Promise<PageCountResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ValidationError(
      'The uploaded file is not a valid PPTX (Office Open XML) presentation',
    );
  }

  const presentationEntry = zip.getEntry('ppt/presentation.xml');
  const contentTypesEntry = zip.getEntry('[Content_Types].xml');
  if (!presentationEntry || !contentTypesEntry) {
    throw new ValidationError(
      'The uploaded file is not a valid PPTX (Office Open XML) presentation',
    );
  }

  const slideCount = zip.getEntries().filter((e) => SLIDE_ENTRY_PATTERN.test(e.entryName)).length;
  if (slideCount < 1) {
    throw new ValidationError('Unable to determine the slide count for this PPTX file');
  }

  return { pageCount: slideCount };
}
