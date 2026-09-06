export type DocumentFileType = 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'PPT' | 'PPTX' | 'JPG' | 'PNG'

export interface SafeDocument {
  documentId: string
  fileName: string
  fileUrl: string
  fileType: DocumentFileType
  mimeType: string
  fileSize: number
  fileHash: string
  pageCount: number | null
  uploadedAt: string
}
