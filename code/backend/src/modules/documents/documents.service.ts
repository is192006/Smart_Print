import { prisma } from '../../lib/prisma';
import { storage } from '../../lib/storage';
import { countPdfPages } from '../../lib/pdf';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export async function uploadDocument(userId: number, originalName: string, buffer: Buffer) {
  const pageCount = await countPdfPages(buffer);
  const { url } = await storage.save(buffer, originalName);

  return prisma.document.create({
    data: {
      userId,
      fileName: originalName,
      fileUrl: url,
      pageCount,
    },
  });
}

export async function listDocuments(userId: number) {
  return prisma.document.findMany({ where: { userId }, orderBy: { uploadedAt: 'desc' } });
}

export async function getDocumentForDownload(userId: number, documentId: number) {
  const document = await prisma.document.findUnique({ where: { documentId } });
  if (!document) throw new NotFoundError('Document not found');
  if (document.userId !== userId) throw new ForbiddenError('You cannot access this document');

  const buffer = await storage.read(document.fileUrl);
  return { document, buffer };
}
