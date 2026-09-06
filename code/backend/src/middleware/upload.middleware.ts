import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { env } from '../config/env';
import { PayloadTooLargeError, ValidationError } from '../utils/errors';

// Memory storage: the buffer is fully validated (extension, MIME,
// signature, parser) in the document service before anything is ever
// written to disk, so a rejected upload never touches the filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: 1 },
});

// Wraps multer's callback-style error handling so a bad upload (oversized
// file, malformed multipart body) reaches the centralized error handler as
// a clean AppError instead of an unhandled exception.
export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(
          new PayloadTooLargeError(
            `File exceeds the maximum allowed size of ${env.maxFileSizeMb}MB`,
          ),
        );
        return;
      }
      next(new ValidationError(err.message));
      return;
    }
    next(err);
  });
}
