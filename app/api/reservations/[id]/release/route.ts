import { NextResponse } from 'next/server';
import { ReleaseReason } from '@prisma/client';
import { releaseReservation } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const reason = payload?.reason === 'payment_failed' ? ReleaseReason.PAYMENT_FAILED : ReleaseReason.USER_CANCELLED;

  const result = await releaseReservation({ id, reason });
  return NextResponse.json(result.body, { status: result.statusCode });
}