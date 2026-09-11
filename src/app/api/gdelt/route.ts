import { NextResponse } from 'next/server';
import { fetchGdeltWindows } from '@/lib/gdeltEvents';

export const maxDuration = 60;
export const revalidate = 900;

/**
 * GDELT 2.0 geocoded events for the Osiris File region (Egypt, Libya, Sudan,
 * Gaza, Red Sea, Gulf) from the last few 15-minute exports.
 * Free, no auth. (In upstream Osiris this path served GDACS disaster alerts;
 * it now serves actual GDELT records.)
 *   ?windows=1..16  exports to read (default 4)
 *   ?quad=3,4       CAMEO QuadClass filter
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const windows = Math.min(16, Math.max(1, Number(sp.get('windows')) || 4));
  const quads = (sp.get('quad') || '').split(',').map(Number).filter(q => q >= 1 && q <= 4);
  try {
    const { events, scanned, windowsRead, window } = await fetchGdeltWindows({
      windows, quads, bbox: [9, 8, 60, 38], actorCountries: ['EGY', 'LBY', 'SDN', 'PSE', 'ISR', 'YEM', 'IRN'], limit: 2000,
    });
    return NextResponse.json({ events, total: events.length, scanned, windowsRead, latestWindow: window, source: 'GDELT 2.0 Events', timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } });
  } catch (error) {
    return NextResponse.json({ events: [], total: 0, error: error instanceof Error ? error.message : 'GDELT unavailable' }, { status: 502 });
  }
}
