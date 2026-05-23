import { NextResponse } from 'next/server';
import { confirmReservation } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await confirmReservation({
    id,
    idempotencyKey: request.headers.get('idempotency-key')
  });

  return NextResponse.json(result.body, { status: result.statusCode });
}