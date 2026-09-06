import { DocumentFileType } from '../config/documentTypes';

// Document fields safe to return in API responses - never a filesystem
// path or the internal storageKey.
export interface SafeDocument {
  documentId: string;
  fileName: string;
  fileUrl: string;
  fileType: DocumentFileType;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  pageCount: number | null;
  uploadedAt: Date;
}

export interface UploadedFileInput {
  buffer: Buffer;
  originalName: string;
  declaredMimeType: string;
  size: number;
}
