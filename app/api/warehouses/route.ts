import { NextResponse } from 'next/server';
import { listWarehouses } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const warehouses = await listWarehouses();
  return NextResponse.json({ warehouses });
}