import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';

export const maxDuration = 300;

/**
 * The dossier briefing. Generated on ingest (at most once per ~30 minutes)
 * and served from the store; this route never calls Gemini itself, so page
 * views cannot exhaust the free-tier quota or the 5 req/min limit.
 */
export async function GET() {
  const store = await getStore();
  return NextResponse.json({ ...store.briefing, storeGeneratedAt: store.generatedAt }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } });
}
