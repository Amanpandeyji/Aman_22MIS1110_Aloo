import { NextResponse } from 'next/server';
import { reserveSchema } from '@/lib/schemas';
import { reserveInventory } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = reserveSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await reserveInventory({
    ...parsed.data,
    idempotencyKey: request.headers.get('idempotency-key')
  });

  return NextResponse.json(result.body, { status: result.statusCode });
}