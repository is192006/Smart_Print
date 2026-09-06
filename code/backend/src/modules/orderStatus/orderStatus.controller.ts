import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../lib/errors';
import { getOrderForUser } from '../orders/orders.service';

export async function history(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const order = await getOrderForUser(req.user, Number(req.params.orderId));
  res.json(order.statusHistory);
}
