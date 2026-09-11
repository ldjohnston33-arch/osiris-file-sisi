import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { buildStore, getStore, STORE_TAG } from '@/lib/osiris/store';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Forces a refresh of the cached store.
 *
 * Auth: when CRON_SECRET is set, requests must send `Authorization: Bearer
 * <CRON_SECRET>` (what Vercel Cron sends) or `?secret=<CRON_SECRET>`. Without
 * CRON_SECRET the route is open but throttled to one refresh per 10 minutes.
 *
 * `?fresh=1` (dev or authorised only) runs the ingest synchronously and
 * returns the result, used by tools/snapshot.mjs to write the fallback file.
 */
let lastForced = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const authorised = secret ? bearer === secret || url.searchParams.get('secret') === secret : false;
  const isDev = process.env.NODE_ENV !== 'production';

  if (secret && !authorised) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  if (url.searchParams.get('fresh') === '1') {
    if (!authorised && !isDev) return NextResponse.json({ error: 'fresh=1 requires CRON_SECRET' }, { status: 401 });
    const store = await buildStore();
    return NextResponse.json(store);
  }

  if (!secret && Date.now() - lastForced < 10 * 60_000) {
    const store = await getStore();
    return NextResponse.json({ refreshed: false, reason: 'throttled (set CRON_SECRET to lift)', generatedAt: store.generatedAt });
  }
  lastForced = Date.now();
  revalidateTag(STORE_TAG, 'max');
  const store = await getStore();
  return NextResponse.json({ refreshed: true, generatedAt: store.generatedAt, events: store.events.length, mode: store.mode });
}

export const POST = GET;
