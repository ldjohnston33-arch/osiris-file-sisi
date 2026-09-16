/**
 * The event store: one ingest, one normalized array, three views.
 *
 * Refresh model ("live" = scheduled refresh):
 *   getStore() is wrapped in Next's data cache with a 30-minute revalidate.
 *   The first request after expiry is served the previous store while a
 *   background regeneration runs the full ingest (serverless-friendly: no
 *   cron needed, nothing re-hits upstreams per page view).
 *
 * Persistence (optional): with Upstash Redis env vars set, each ingest merges
 * into a rolling 180-day history so the store accumulates beyond what the
 * upstream feeds currently expose and "new since last visit" uses true
 * first-seen times. Without it, GDELT's 90-day window rebuilds history on
 * every ingest.
 *
 * Fallback: if live sources return almost nothing (network outage), the
 * committed snapshot in src/data/snapshot.json keeps the page populated and
 * the header says so.
 */

import { unstable_cache } from 'next/cache';
import type { OsirisEvent, RawItem, SourceHealth, Store } from './types';
import type { SourceAdapter } from './sources/common';
import { presidency, sis, mena } from './sources/state';
import { ahram, gdeltDoc, gdeltGeo, newsRss, docTone, getLastGeoSignals } from './sources/independent';
import { classify } from './classify';
import { mergeClusters } from './corroborate';
import { applyLinkage, applyTripContext, buildStatus, normalizeOrigins, rankPartners } from './enrich';
import { computeRisk } from './risk';
import { polishReads, rulesRead } from './analyst';
import { makeBriefing } from './briefing';
import { MARITIME_STATIC } from './geometry';
import { aisSnapshot } from './ais';
import { getHeroImage } from './portrait';
import snapshot from '@/data/snapshot.json';

export const STORE_TAG = 'osiris-store';
export const REVALIDATE_SECONDS = 1800;
const DAY = 86_400_000;
const HISTORY_DAYS = 180;
const MAX_EVENTS = 650;

/* ── optional Upstash persistence ─────────────────────────────────────── */

function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
const HISTORY_KEY = 'osiris:sisi:history:v1';

async function loadHistory(): Promise<OsirisEvent[] | null> {
  const env = redisEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/get/${HISTORY_KEY}`, { headers: { Authorization: `Bearer ${env.token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { result: string | null };
    return json.result ? (JSON.parse(json.result) as OsirisEvent[]) : [];
  } catch {
    return null;
  }
}

async function saveHistory(events: OsirisEvent[]) {
  const env = redisEnv();
  if (!env) return;
  try {
    await fetch(`${env.url}/set/${HISTORY_KEY}`, { method: 'POST', headers: { Authorization: `Bearer ${env.token}` }, body: JSON.stringify(events), cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch { /* best effort */ }
}

/* ── ingest ───────────────────────────────────────────────────────────── */

async function timed(adapter: SourceAdapter): Promise<{ items: RawItem[]; health: SourceHealth }> {
  const t0 = Date.now();
  try {
    const { items, note } = await adapter.run();
    return { items, health: { id: adapter.id, name: adapter.name, ok: items.length > 0, items: items.length, ms: Date.now() - t0, note: [adapter.method, note].filter(Boolean).join(' · ') } };
  } catch (e) {
    return { items: [], health: { id: adapter.id, name: adapter.name, ok: false, items: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 300) : String(e), note: adapter.method } };
  }
}

/** Drops items that have nothing to do with Egypt or the tracked theaters. */
function relevant(e: OsirisEvent): boolean {
  if (e.involvesSisi) return true;
  if (e.theaters.length) return true;
  if (e.category === 'maritime') return true;
  return e.sources[0]?.kind === 'state';
}

export async function buildStore(): Promise<Store> {
  const now = new Date();
  const nowMs = now.getTime();

  const [runs, history] = await Promise.all([
    Promise.all([presidency, sis, mena, ahram, newsRss, gdeltGeo, gdeltDoc].map(timed)),
    loadHistory(),
  ]);
  const health = runs.map(r => r.health);

  // Media tone for the risk model (shares GDELT DOC's 5-second spacing).
  const tones: Record<string, number | undefined> = {};
  const toneT0 = Date.now();
  const toneErrors: string[] = [];
  for (const [code, q] of [['EG', 'Egypt sourcelang:english'], ['LY', 'Libya sourcelang:english'], ['SD', 'Sudan sourcelang:english']] as const) {
    try {
      const series = await docTone(q, '7d');
      if (series.length) tones[code] = series.reduce((s, p) => s + p.value, 0) / series.length;
    } catch (e) {
      toneErrors.push(`${code}: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
    }
  }
  health.push({ id: 'gdelt-tone', name: 'GDELT DOC tone timeline (risk model)', ok: Object.keys(tones).length > 0, items: Object.keys(tones).length, ms: Date.now() - toneT0, error: toneErrors.join('; ') || undefined, note: 'timelinetone, 7-day window' });

  const cutoff = nowMs - 120 * DAY;
  let classified = runs
    .flatMap(r => r.items)
    .filter(i => i.title && i.url && Date.parse(i.date) >= cutoff)
    .map(i => classify(i, now))
    .filter(relevant);

  // Without persistence, "first seen" is the publication time.
  if (!redisEnv()) classified = classified.map(e => ({ ...e, firstSeen: e.date < e.firstSeen ? e.date : e.firstSeen }));

  let mode: Store['mode'] = 'live';
  let pool: OsirisEvent[] = classified;
  if (history && history.length) {
    // Carry forward history, keep original first-seen times.
    const firstSeenByUrl = new Map<string, string>();
    for (const h of history) for (const s of h.sources) firstSeenByUrl.set(s.url, h.firstSeen);
    pool = [
      ...history.filter(h => Date.parse(h.date) >= nowMs - HISTORY_DAYS * DAY),
      ...classified.map(e => ({ ...e, firstSeen: firstSeenByUrl.get(e.source.url) ?? e.firstSeen })),
    ].map(e => ({ ...e, sources: e.sources.slice(0, 12) }));
  }
  if (classified.length < 10) {
    const snap = (snapshot as unknown as Store).events ?? [];
    if (snap.length) {
      pool = [...pool, ...snap];
      mode = classified.length ? 'mixed' : 'snapshot';
    }
  }

  let events = mergeClusters(pool);
  events = applyTripContext(events);
  events = applyLinkage(events);
  events = normalizeOrigins(events);

  // Keep Sisi-centric items preferentially when trimming.
  if (events.length > MAX_EVENTS) {
    const core = events.filter(e => e.involvesSisi || e.sources.some(s => s.kind === 'state'));
    const rest = events.filter(e => !(e.involvesSisi || e.sources.some(s => s.kind === 'state')));
    events = [...core, ...rest].slice(0, MAX_EVENTS).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  events = events.map(e => ({ ...e, sources: e.sources.slice(0, 10) }));

  const partners = rankPartners(events, nowMs);
  const risk = computeRisk(getLastGeoSignals(), tones);
  const status = buildStatus(events, nowMs);

  for (const e of events) {
    const read = rulesRead(e, events, nowMs);
    if (read) e.analystRead = read;
  }
  const t1 = Date.now();
  const [polish, brief, ais, heroImage] = await Promise.all([polishReads(events), makeBriefing(events, partners, risk, nowMs), aisSnapshot(), getHeroImage()]);
  health.push({
    id: 'gemini', name: 'Gemini (briefing + Analyst Read)', ok: brief.briefing.method === 'gemini', items: polish.polished + (brief.briefing.method === 'gemini' ? 1 : 0), ms: Date.now() - t1,
    error: [brief.error, polish.error].filter(Boolean).join('; ') || undefined,
    note: brief.briefing.method === 'gemini' ? `model ${brief.briefing.model}; ${polish.polished} reads polished` : 'GEMINI_API_KEY not set or call failed: rules-based fallback in use',
  });
  health.push({ id: 'ais', name: 'AIS vessel snapshot (optional)', ok: ais.vessels > 0, items: ais.vessels, ms: 0, note: ais.note });
  health.push({ id: 'redis', name: 'Upstash history (optional)', ok: history !== null, items: history?.length ?? 0, ms: 0, note: redisEnv() ? (history === null ? 'configured but unreachable' : 'rolling 180-day history') : 'not configured: history rebuilt from GDELT each ingest' });

  const store: Store = {
    version: 1,
    generatedAt: now.toISOString(),
    mode,
    events,
    briefing: brief.briefing,
    risk,
    partners,
    maritime: { features: [...MARITIME_STATIC, ...ais.features], vesselCount: ais.vessels, vesselSource: ais.vessels ? 'aisstream.io snapshot' : 'none' },
    health,
    status,
    heroImage,
  };

  if (redisEnv() && mode === 'live') await saveHistory(events);
  return store;
}

/** Cached accessor used by the page and every API route. */
export const getStore = unstable_cache(buildStore, ['osiris-sisi-store-v1'], { revalidate: REVALIDATE_SECONDS, tags: [STORE_TAG] });
