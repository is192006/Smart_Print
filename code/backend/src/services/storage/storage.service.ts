// Storage abstraction: the document service/controller talk only to this
// interface. Swapping LocalStorageService for a future S3-compatible
// implementation should not require changing anything outside this folder.
export interface StorageService {
  save(storageKey: string, data: Buffer): Promise<void>;
  getReadStream(storageKey: string): NodeJS.ReadableStream;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
