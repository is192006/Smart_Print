import { DocumentFileType } from '@prisma/client';

export { DocumentFileType };

export interface DocumentTypeDefinition {
  fileType: DocumentFileType;
  // Lowercase, dot-prefixed. The first entry is the canonical extension
  // used for the generated storage filename.
  extensions: string[];
  // Client-declared MIME types accepted for this type. Never trusted alone.
  mimeTypes: string[];
  // Acceptable raw byte signatures at the start of the file.
  magicBytes: Buffer[];
  // Acceptable `ext` values reported by the `file-type` content-sniffing
  // library for this type.
  detectedExtensions: string[];
}

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// Legacy MS Office binary container (Compound File Binary Format), shared
// by .doc/.xls/.ppt - the outer signature alone cannot distinguish which.
const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

// Single source of truth for every format SmartPrint accepts. Adding a new
// format later (e.g. .txt or .odt) means adding one entry here plus a
// processor - no other validation code needs to change.
export const DOCUMENT_TYPES: DocumentTypeDefinition[] = [
  {
    fileType: 'PDF',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    magicBytes: [Buffer.from('%PDF-')],
    detectedExtensions: ['pdf'],
  },
  {
    fileType: 'JPG',
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
    magicBytes: [Buffer.from([0xff, 0xd8, 0xff])],
    detectedExtensions: ['jpg'],
  },
  {
    fileType: 'PNG',
    extensions: ['.png'],
    mimeTypes: ['image/png'],
    magicBytes: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    detectedExtensions: ['png'],
  },
  {
    fileType: 'DOCX',
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magicBytes: [ZIP_SIGNATURE],
    detectedExtensions: ['docx'],
  },
  {
    fileType: 'XLSX',
    extensions: ['.xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    magicBytes: [ZIP_SIGNATURE],
    detectedExtensions: ['xlsx'],
  },
  {
    fileType: 'PPTX',
    extensions: ['.pptx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    magicBytes: [ZIP_SIGNATURE],
    detectedExtensions: ['pptx'],
  },
  {
    fileType: 'DOC',
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    magicBytes: [CFB_SIGNATURE],
    detectedExtensions: ['doc', 'cfb'],
  },
  {
    fileType: 'XLS',
    extensions: ['.xls'],
    mimeTypes: ['application/vnd.ms-excel'],
    magicBytes: [CFB_SIGNATURE],
    detectedExtensions: ['xls', 'cfb'],
  },
  {
    fileType: 'PPT',
    extensions: ['.ppt'],
    mimeTypes: ['application/vnd.ms-powerpoint'],
    magicBytes: [CFB_SIGNATURE],
    detectedExtensions: ['ppt', 'cfb'],
  },
];

export const ALL_ALLOWED_EXTENSIONS = DOCUMENT_TYPES.flatMap((t) => t.extensions);

// Legacy OLE/CFB-based formats where the `file-type` library can only
// confirm "this is some compound-file document", not which one - the
// magic-byte check plus later processor validation carry more weight here.
const LEGACY_CFB_TYPES: DocumentFileType[] = ['DOC', 'XLS', 'PPT'];
export function isLegacyCfbType(fileType: DocumentFileType): boolean {
  return LEGACY_CFB_TYPES.includes(fileType);
}

export function findDocumentTypeByExtension(extension: string): DocumentTypeDefinition | undefined {
  const lower = extension.toLowerCase();
  return DOCUMENT_TYPES.find((t) => t.extensions.includes(lower));
}
