import contentDisposition from 'content-disposition';
import { Response } from 'express';

import * as documentService from '../services/document.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, ValidationError } from '../utils/errors';

interface UploadRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user.userId;
}

function requireUser(req: AuthenticatedRequest): NonNullable<AuthenticatedRequest['user']> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}

// Ownership always comes from the JWT (req.user.userId) - the request body,
// query string, and route params are never trusted for it.
export const upload = asyncHandler(async (req: UploadRequest, res: Response) => {
  const userId = requireUserId(req);
  if (!req.file) {
    throw new ValidationError('No file provided');
  }

  const document = await documentService.uploadDocument(userId, {
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    declaredMimeType: req.file.mimetype,
    size: req.file.size,
  });

  res.status(201).json({ success: true, data: { document } });
});

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const documents = await documentService.listDocumentsForUser(userId);
  res.status(200).json({ success: true, data: { documents } });
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const document = await documentService.getDocumentForUser(userId, req.params.id);
  res.status(200).json({ success: true, data: { document } });
});

export const download = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = requireUser(req);
  const { fileName, mimeType, stream } = await documentService.getDocumentForDownload(
    user.userId,
    user.role,
    req.params.id,
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', contentDisposition(fileName, { type: 'attachment' }));
  // Never derived from client input and never exposes a filesystem path -
  // the stream comes from the storage abstraction, not a resolved path.
  (stream as NodeJS.ReadableStream).pipe(res);
});

// Same authorization as download, but `inline` so a browser renders a
// supported type (e.g. PDF) directly instead of forcing a save dialog.
export const view = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = requireUser(req);
  const { fileName, mimeType, stream } = await documentService.getDocumentForView(
    user.userId,
    user.role,
    req.params.id,
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', contentDisposition(fileName, { type: 'inline' }));
  (stream as NodeJS.ReadableStream).pipe(res);
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  await documentService.deleteDocument(userId, req.params.id);
  res.status(200).json({ success: true, message: 'Document deleted successfully' });
});
