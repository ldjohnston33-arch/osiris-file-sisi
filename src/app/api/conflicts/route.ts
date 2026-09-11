import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';
import { THEATER_DEFS } from '@/lib/osiris/geometry';

export const maxDuration = 300;

/** Tracked conflict theaters with live item counts and their Egyptian diplomatic linkage. */
export async function GET() {
  const store = await getStore();
  const since = Date.now() - 14 * 86_400_000;
  const zones = THEATER_DEFS.map(t => {
    const items = store.events.filter(e => e.theaters.includes(t.id) && Date.parse(e.date) >= since);
    return {
      id: t.id,
      label: t.label,
      center: { lng: t.center[0], lat: t.center[1] },
      egyptLink: t.egyptLink,
      conflictItems14d: items.filter(e => e.category === 'conflict').length,
      diplomaticItems14d: items.filter(e => ['diplomatic', 'movement', 'inbound'].includes(e.category)).length,
      linked: items.filter(e => e.linkageKind === 'dynamic').length,
      latest: items.slice(0, 5).map(e => ({ id: e.id, date: e.date, title: e.title, category: e.category, diplomaticLinkage: e.diplomaticLinkage })),
    };
  });
  return NextResponse.json({ zones, generatedAt: store.generatedAt }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } });
}
