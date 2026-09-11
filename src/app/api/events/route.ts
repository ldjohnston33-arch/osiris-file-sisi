import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';

export const maxDuration = 300;

/** The whole event store. `?since=<ISO>` returns {unchanged:true} when nothing is newer. */
export async function GET(req: Request) {
  const store = await getStore();
  const since = new URL(req.url).searchParams.get('since');
  if (since && Date.parse(store.generatedAt) <= Date.parse(since)) {
    return NextResponse.json({ unchanged: true, generatedAt: store.generatedAt }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  }
  return NextResponse.json(store, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
