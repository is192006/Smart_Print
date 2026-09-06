import { imageSize } from 'image-size';

import { ValidationError } from '../../../utils/errors';
import { PageCountResult } from './types';

// SmartPrint's current model treats one uploaded image as one printable
// page. Decoding the header (and requiring real dimensions back) is also
// the parser/decoder validation layer for images - a corrupted or
// truncated JPEG/PNG will fail here even if its magic bytes looked right.
export async function extractImagePageCount(buffer: Buffer): Promise<PageCountResult> {
  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(buffer);
  } catch {
    throw new ValidationError('The uploaded file is not a valid or readable image');
  }

  if (!dimensions.width || !dimensions.height) {
    throw new ValidationError('The uploaded file is not a valid or readable image');
  }

  return { pageCount: 1 };
}
