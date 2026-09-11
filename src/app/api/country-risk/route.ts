import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';

export const maxDuration = 300;

/** L4 composite risk for Egypt, Libya and Sudan with full component breakdown. */
export async function GET() {
  const store = await getStore();
  return NextResponse.json({ countries: store.risk, generatedAt: store.generatedAt, method: 'structural 55% + GDELT conflict intensity 20% + GDELT tone 15% + neighbour spillover 10%' },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } });
}
