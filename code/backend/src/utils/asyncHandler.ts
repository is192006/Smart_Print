import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

// Express 4 does not forward rejected promises to the error handler on its
// own; wrap async controllers with this so thrown/rejected errors reach
// errorHandler instead of crashing the process.
export function asyncHandler<Req extends Request = Request>(handler: AsyncRouteHandler<Req>) {
  return (req: Req, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
