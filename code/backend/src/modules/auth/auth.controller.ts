import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { UnauthorizedError } from '../../lib/errors';
import * as authService from './auth.service';

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const session = await authService.registerStudent(input);
  res.status(201).json(session);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const session = await authService.login(input.email, input.password);
  res.json(session);
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const user = await prisma.user.findUnique({
    where: { userId: req.user.userId },
    select: {
      userId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      shopId: true,
      createdAt: true,
    },
  });
  res.json(user);
}
