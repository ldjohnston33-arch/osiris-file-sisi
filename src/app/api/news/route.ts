import { NextResponse } from 'next/server';
import { newsRss } from '@/lib/osiris/sources/independent';

export const maxDuration = 60;
export const revalidate = 1800;

/** Raw MENA news aggregation (international RSS filtered to Egypt / tracked theaters). */
export async function GET() {
  try {
    const { items, note } = await newsRss.run();
    items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    return NextResponse.json({ items, total: items.length, note, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } });
  } catch (error) {
    return NextResponse.json({ items: [], error: error instanceof Error ? error.message : 'news unavailable' }, { status: 502 });
  }
}
