import type { Request, Response } from 'express';
import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';
import * as usersService from './users.service';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(72),
  role: z.enum([UserRole.SHOP_STAFF, UserRole.ADMIN]),
  shopId: z.number().int().positive().optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

const shopAssignSchema = z.object({
  shopId: z.number().int().positive(),
});

export async function list(req: Request, res: Response) {
  const role = req.query.role ? (req.query.role as UserRole) : undefined;
  res.json(await usersService.listUsers(role));
}

export async function create(req: Request, res: Response) {
  const input = createSchema.parse(req.body);
  res.status(201).json(await usersService.createStaffOrAdmin(input));
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  res.json(await usersService.setUserStatus(Number(req.params.userId), status));
}

export async function assignShop(req: Request, res: Response) {
  const { shopId } = shopAssignSchema.parse(req.body);
  res.json(await usersService.reassignShopStaff(Number(req.params.userId), shopId));
}
