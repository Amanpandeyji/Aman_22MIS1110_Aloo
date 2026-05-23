import { NextResponse } from 'next/server';
import { getCatalog, toCatalogSummary } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await getCatalog();
  return NextResponse.json(toCatalogSummary(products));
}