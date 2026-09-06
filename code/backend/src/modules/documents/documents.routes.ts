import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth';
import { env } from '../../config/env';
import { BadRequestError } from '../../lib/errors';
import * as documentsController from './documents.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new BadRequestError('Only PDF files are supported'));
    }
    cb(null, true);
  },
});

export const documentsRouter = Router();

documentsRouter.use(authenticate, authorize(UserRole.STUDENT));

documentsRouter.post('/', upload.single('file'), documentsController.upload);
documentsRouter.get('/', documentsController.list);
documentsRouter.get('/:documentId/download', documentsController.download);
