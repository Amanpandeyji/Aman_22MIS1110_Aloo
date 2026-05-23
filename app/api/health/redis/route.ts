import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = `health:redis:${Date.now()}`;

  try {
    const redis = getRedis();
    await redis.set(key, 'ok', { ex: 30 });
    const value = await redis.get<string>(key);

    return NextResponse.json({ ok: value === 'ok' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
