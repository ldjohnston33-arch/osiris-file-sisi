import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';
import { SHIPPING_LANE } from '@/lib/osiris/geometry';

export const maxDuration = 300;

/** Red Sea / Suez layer: ports, chokepoints, shipping lane, optional AIS vessel density, and recent maritime items. */
export async function GET() {
  const store = await getStore();
  const items = store.events.filter(e => e.category === 'maritime').slice(0, 40);
  return NextResponse.json({ ...store.maritime, lane: SHIPPING_LANE, items, generatedAt: store.generatedAt },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } });
}
