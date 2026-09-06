import { DocumentFileType } from '../../../config/documentTypes';
import { extractDocxPageCount } from './docx.processor';
import { extractImagePageCount } from './image.processor';
import { extractLegacyOfficePageCount } from './legacyOffice.processor';
import { extractPdfPageCount } from './pdf.processor';
import { extractPptxPageCount } from './pptx.processor';
import { PageCountResult } from './types';
import { extractXlsxPageCount } from './xlsx.processor';

export { PageCountResult } from './types';

// Also the "parser/decoder validation" layer described in the upload
// pipeline: each processor throws a ValidationError if the file cannot
// actually be parsed as the type its extension/signature claimed.
export async function extractPageCount(
  fileType: DocumentFileType,
  buffer: Buffer,
): Promise<PageCountResult> {
  switch (fileType) {
    case 'PDF':
      return extractPdfPageCount(buffer);
    case 'JPG':
    case 'PNG':
      return extractImagePageCount(buffer);
    case 'DOCX':
      return extractDocxPageCount(buffer);
    case 'XLSX':
      return extractXlsxPageCount(buffer);
    case 'PPTX':
      return extractPptxPageCount(buffer);
    case 'DOC':
    case 'XLS':
    case 'PPT':
      return extractLegacyOfficePageCount();
    default: {
      const exhaustiveCheck: never = fileType;
      throw new Error(`No document processor registered for file type: ${exhaustiveCheck}`);
    }
  }
}
