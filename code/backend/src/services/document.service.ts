import { randomUUID } from 'node:crypto';

import { Document, UserRole } from '@prisma/client';

import { prisma } from '../config/prisma';
import { storageService } from './storage';
import { SafeDocument, UploadedFileInput } from '../types/document.types';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { generateStorageKey, sanitizeOriginalFileName } from '../utils/fileNaming';
import { sha256Hex } from '../utils/hash';
import { validateUploadedFile } from './documents/fileValidation.service';
import { extractPageCount } from './documents/processors';

function toSafeDocument(document: Document): SafeDocument {
  return {
    documentId: document.documentId,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    fileType: document.fileType,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    fileHash: document.fileHash,
    pageCount: document.pageCount,
    uploadedAt: document.uploadedAt,
  };
}

function buildDownloadUrl(documentId: string): string {
  // An application-level reference, not a filesystem path - satisfies
  // Document.fileUrl without ever exposing where/how the file is stored.
  return `/api/documents/${documentId}/download`;
}

// Upload pipeline: validate -> process (page count) -> store -> persist.
// If storing succeeds but the DB write fails, the just-saved file is
// removed so nothing is orphaned. If processing/validation fails, nothing
// has been written to storage or the DB yet.
export async function uploadDocument(
  userId: string,
  file: UploadedFileInput,
): Promise<SafeDocument> {
  if (!file || file.size === 0 || file.buffer.length === 0) {
    throw new ValidationError('Uploaded file is empty');
  }

  const validated = await validateUploadedFile(
    file.buffer,
    file.originalName,
    file.declaredMimeType,
  );
  const { pageCount } = await extractPageCount(validated.fileType, file.buffer);

  const fileHash = sha256Hex(file.buffer);
  const storageKey = generateStorageKey(validated.extension);
  const fileName = sanitizeOriginalFileName(file.originalName);

  await storageService.save(storageKey, file.buffer);

  // Generated up front (rather than letting Prisma default it) so the
  // download-URL reference can be written in the same insert as everything
  // else - one DB write, not a create-then-patch.
  const documentId = randomUUID();

  try {
    const document = await prisma.document.create({
      data: {
        documentId,
        userId,
        fileName,
        fileUrl: buildDownloadUrl(documentId),
        storageKey,
        fileType: validated.fileType,
        mimeType: validated.mimeType,
        fileSize: file.size,
        fileHash,
        pageCount,
      },
    });

    return toSafeDocument(document);
  } catch (err) {
    // The DB record does not exist (or was rolled back) - do not leave the
    // physical file behind. Safe to retry: delete() is idempotent.
    await storageService.delete(storageKey).catch(() => undefined);
    throw err;
  }
}

export async function listDocumentsForUser(userId: string): Promise<SafeDocument[]> {
  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
  });
  return documents.map(toSafeDocument);
}

// Ownership check lives here, not in the controller, so every entry point
// (get/download/delete) enforces it identically. A document that does not
// exist and one that belongs to someone else are indistinguishable to the
// caller - both surface as 404 - so requesting another student's document
// ID never confirms that it exists.
async function findOwnedDocumentOrThrow(userId: string, documentId: string): Promise<Document> {
  const document = await prisma.document.findUnique({ where: { documentId } });
  if (!document || document.userId !== userId) {
    throw new NotFoundError('Document not found');
  }
  return document;
}

export async function getDocumentForUser(
  userId: string,
  documentId: string,
): Promise<SafeDocument> {
  const document = await findOwnedDocumentOrThrow(userId, documentId);
  return toSafeDocument(document);
}

// Role-aware access check reused by both view and download. Derives every
// relationship (document -> orderDocument -> order -> shop -> staff.shopId)
// from the database - never trusts a client-supplied shopId/orderId/userId.
//
//   ADMIN       -> any document
//   SHOP_STAFF  -> only a document attached (via OrderDocument) to an order
//                  placed at their own, ACTIVE-staff-assigned shop
//   STUDENT/
//   FACULTY     -> only their own uploaded document (existing ownership rule)
//
// A document that does not exist and one the caller is not authorized to
// know about are indistinguishable - both surface as 404 - so probing
// another shop's/student's document ID never confirms it exists.
async function findAccessibleDocumentOrThrow(
  userId: string,
  role: UserRole,
  documentId: string,
): Promise<Document> {
  const document = await prisma.document.findUnique({ where: { documentId } });
  if (!document) {
    throw new NotFoundError('Document not found');
  }

  if (role === 'ADMIN') {
    return document;
  }

  if (role === 'SHOP_STAFF') {
    const staffUser = await prisma.user.findUnique({ where: { userId } });
    if (!staffUser || staffUser.status !== 'ACTIVE' || !staffUser.shopId) {
      throw new NotFoundError('Document not found');
    }

    const linkedToStaffShop = await prisma.orderDocument.findFirst({
      where: {
        documentId,
        order: { shopId: staffUser.shopId },
      },
    });
    if (!linkedToStaffShop) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }

  if (document.userId !== userId) {
    throw new NotFoundError('Document not found');
  }
  return document;
}

export interface DownloadableDocument {
  fileName: string;
  mimeType: string;
  stream: NodeJS.ReadableStream;
}

async function loadDocumentStream(document: Document): Promise<DownloadableDocument> {
  const exists = await storageService.exists(document.storageKey);
  if (!exists) {
    // Metadata exists but the physical file is gone - treat it the same as
    // "not found" rather than crashing or leaking storage internals.
    throw new NotFoundError('Document file is not available');
  }

  return {
    fileName: document.fileName,
    mimeType: document.mimeType,
    stream: storageService.getReadStream(document.storageKey),
  };
}

export async function getDocumentForDownload(
  userId: string,
  role: UserRole,
  documentId: string,
): Promise<DownloadableDocument> {
  const document = await findAccessibleDocumentOrThrow(userId, role, documentId);
  return loadDocumentStream(document);
}

// Same authorization as download - only the controller's Content-Disposition
// (inline vs attachment) differs.
export async function getDocumentForView(
  userId: string,
  role: UserRole,
  documentId: string,
): Promise<DownloadableDocument> {
  const document = await findAccessibleDocumentOrThrow(userId, role, documentId);
  return loadDocumentStream(document);
}

// Phase 4: a document referenced by any order can no longer be deleted -
// the order's snapshot pricing survives, but the source file it was priced
// against must remain available (re-printing, disputes, etc.). This is the
// hook Phase 3 left specifically for this check.
async function assertDocumentDeletable(document: Document): Promise<void> {
  const referencingOrder = await prisma.orderDocument.findFirst({
    where: { documentId: document.documentId },
  });
  if (referencingOrder) {
    throw new ConflictError('This document is referenced by an order and cannot be deleted');
  }
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const document = await findOwnedDocumentOrThrow(userId, documentId);
  await assertDocumentDeletable(document);

  // Physical file first, then metadata, per the documented deletion flow.
  // delete() is a no-op (not an error) if the file is already missing, so
  // this whole operation is safe to retry.
  await storageService.delete(document.storageKey);
  await prisma.document.delete({ where: { documentId: document.documentId } });
}
