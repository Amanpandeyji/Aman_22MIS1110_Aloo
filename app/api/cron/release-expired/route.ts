import { NextResponse } from 'next/server';
import { cleanupExpiredReservations } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization');
  return header === secret || header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const released = await cleanupExpiredReservations();
  return NextResponse.json({ released });
}