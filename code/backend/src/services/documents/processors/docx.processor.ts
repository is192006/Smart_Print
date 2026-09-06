import AdmZip from 'adm-zip';

import { ValidationError } from '../../../utils/errors';
import { PageCountResult } from './types';

// DOCX is a ZIP of XML parts. Confirming it actually contains the expected
// internal structure is this format's parser/decoder validation layer.
//
// Exact page count for Word documents genuinely depends on rendering
// (fonts, margins, page size) which no static Node parser can reproduce.
// Word itself caches its last-computed count in docProps/app.xml's <Pages>
// element on every save - we read that when present. It can go stale if the
// file is edited by a tool that doesn't update it, so it is reported as a
// best-effort figure, not a guarantee.
export async function extractDocxPageCount(buffer: Buffer): Promise<PageCountResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ValidationError('The uploaded file is not a valid DOCX (Office Open XML) document');
  }

  const documentEntry = zip.getEntry('word/document.xml');
  const contentTypesEntry = zip.getEntry('[Content_Types].xml');
  if (!documentEntry || !contentTypesEntry) {
    throw new ValidationError('The uploaded file is not a valid DOCX (Office Open XML) document');
  }

  const appXmlEntry = zip.getEntry('docProps/app.xml');
  if (appXmlEntry) {
    const xml = appXmlEntry.getData().toString('utf8');
    const match = xml.match(/<Pages>(\d+)<\/Pages>/);
    if (match) {
      const pages = Number(match[1]);
      if (pages > 0) {
        return { pageCount: pages };
      }
    }
  }

  return {
    pageCount: null,
    note:
      'DOCX page count unavailable: no cached Word page count (docProps/app.xml <Pages>) was ' +
      'found in this file. Exact pagination requires layout rendering, which is not performed.',
  };
}
