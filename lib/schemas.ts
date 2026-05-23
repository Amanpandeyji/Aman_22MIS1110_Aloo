import { z } from 'zod';

export const reserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(999)
});

export const reservationActionSchema = z.object({
  reason: z.enum(['payment_failed', 'user_cancelled']).optional()
});

export type ReserveInput = z.infer<typeof reserveSchema>;