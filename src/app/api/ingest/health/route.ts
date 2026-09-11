import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';
import { aiEnabled } from '@/lib/ai-engine';

export const maxDuration = 300;

/** Per-source status from the most recent ingest. Check this after deploying. */
export async function GET() {
  const store = await getStore();
  const byFeed: Record<string, number> = {};
  for (const e of store.events) for (const s of e.sources) byFeed[s.feed] = (byFeed[s.feed] ?? 0) + 1;
  const tiers = { state: store.events.filter(e => e.source.tier === 'state').length, corroborated: store.events.filter(e => e.source.tier === 'corroborated').length };
  return NextResponse.json({
    generatedAt: store.generatedAt,
    mode: store.mode,
    events: store.events.length,
    tiers,
    sourcesByFeed: byFeed,
    features: {
      gemini: aiEnabled(),
      ais: !!process.env.AIS_API_KEY,
      redis: !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
      strictSourcing: process.env.OSIRIS_STRICT_SOURCING === '1',
    },
    health: store.health,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
