import type { Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../../lib/errors';
import * as documentsService from './documents.service';

export async function upload(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  if (!req.file) throw new BadRequestError('A PDF file is required (field name: file)');

  const document = await documentsService.uploadDocument(
    req.user.userId,
    req.file.originalname,
    req.file.buffer,
  );
  res.status(201).json(document);
}

export async function list(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  res.json(await documentsService.listDocuments(req.user.userId));
}

export async function download(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const { document, buffer } = await documentsService.getDocumentForDownload(
    req.user.userId,
    Number(req.params.documentId),
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
  res.send(buffer);
}
