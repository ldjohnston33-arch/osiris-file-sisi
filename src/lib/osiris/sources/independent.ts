/**
 * Corroborating / independent sources: Ahram Online (English), GDELT DOC 2.0
 * (global news search), GDELT 2.0 geocoded events, and MENA-focused RSS from
 * international outlets.
 *
 * Note on Ahram: Al-Ahram is state-owned. The build brief counts Ahram Online
 * as corroborating coverage, so it is tagged independent here; set
 * OSIRIS_STRICT_SOURCING=1 to treat it (and other state-affiliated Egyptian
 * outlets listed in STATE_AFFILIATED_DOMAINS) as state instead.
 */

import type { RawItem } from '../types';
import { getJson, getText, mapLimit, sleep } from '../http';
import { EGYPT_RELEVANCE, extractDescription, extractLinks, extractPublishedDate, readFeed, type SourceAdapter } from './common';
import { fetchGdeltWindows } from '@/lib/gdeltEvents';
import { THEATER_TERMS } from '../classify';
import { hasTerm } from '../gazetteer';

export const STATE_DOMAINS = ['presidency.eg', 'sis.gov.eg', 'mena.org.eg'];
/** State-owned or state-aligned Egyptian outlets. Shown as a note in Analyst Mode. */
export const STATE_AFFILIATED_DOMAINS = ['ahram.org.eg', 'akhbarelyom.com', 'egypttoday.com', 'alqaheranews.net', 'extranews.tv', 'gate.ahram.org.eg', 'sada-elbalad.com'];
const strict = () => process.env.OSIRIS_STRICT_SOURCING === '1';

export function kindForDomain(domain: string): 'state' | 'independent' {
  const d = domain.toLowerCase();
  if (STATE_DOMAINS.some(s => d === s || d.endsWith('.' + s))) return 'state';
  if (strict() && STATE_AFFILIATED_DOMAINS.some(s => d === s || d.endsWith('.' + s))) return 'state';
  return 'independent';
}

export function isStateAffiliated(url: string): boolean {
  try {
    const d = new URL(url).hostname.replace(/^www\./, '');
    return STATE_AFFILIATED_DOMAINS.some(s => d === s || d.endsWith('.' + s));
  } catch {
    return false;
  }
}

/* ── Ahram Online ─────────────────────────────────────────────────────── */

const AHRAM_LISTINGS = [
  'https://english.ahram.org.eg/Category/1/1234/Egypt/Foreign-Affairs.aspx',
  'https://english.ahram.org.eg/Category/1/64/Egypt/Politics-.aspx',
  'https://english.ahram.org.eg/Portal/1/Egypt.aspx',
];

export const ahram: SourceAdapter = {
  id: 'ahram',
  name: 'Ahram Online (English)',
  method: 'Section listing pages + article meta (no public RSS found)',
  async run() {
    const seen = new Map<string, string>();
    const notes: string[] = [];
    for (const u of AHRAM_LISTINGS) {
      try {
        const html = await getText(u, { browserUa: true, timeoutMs: 15000 });
        for (const l of extractLinks(html, u, /\/(?:News|NewsContent)\/[\d/]+[^"']*\.aspx$/i)) {
          if (!seen.has(l.url)) seen.set(l.url, l.text);
        }
      } catch (e) {
        notes.push(`${u.split('/').slice(-1)[0]}: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      }
    }
    const links = [...seen].slice(0, 30);
    const items: RawItem[] = await mapLimit(links, 5, async ([url, text]) => {
      let summary = '', date = '';
      try {
        const html = await getText(url, { browserUa: true, timeoutMs: 12000 });
        summary = extractDescription(html);
        date = extractPublishedDate(html) || ahramDateFromBody(html) || '';
      } catch { /* headline only */ }
      return { title: text, summary, url, date, sourceName: 'Ahram Online', kind: strict() ? 'state' : 'independent', feed: 'ahram-html' } as RawItem;
    });
    const dated = items.filter(i => i.date);
    return { items: dated, note: `${links.length} links, ${dated.length} dated${notes.length ? '; ' + notes.join('; ') : ''}` };
  },
};

function ahramDateFromBody(html: string): string | undefined {
  // Ahram prints e.g. "Thursday 11 Sep 2026" near the headline.
  const m = html.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/);
  if (!m) return undefined;
  const t = Date.parse(`${m[1]} ${m[2]} ${m[3]} 12:00 UTC`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/* ── GDELT DOC 2.0 (global news search, no key) ───────────────────────── */

const DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const SISI_Q = '("el-Sisi" OR "al-Sisi" OR Sisi OR Sissi)';

interface DocArticle { url: string; title: string; seendate: string; domain: string; language: string; sourcecountry: string }

function gdeltDate(s: string): string {
  // 20260911T083000Z
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : s;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

/**
 * GDELT asks for at most one request every 5 seconds, and throttles shared
 * cloud IP ranges harder than that. Calls are serialised with 5.5 s spacing
 * and retried with backoff on 429 / "Please limit requests".
 */
let lastDocCall = 0;
let docChain: Promise<unknown> = Promise.resolve();
function docGet<T>(qs: URLSearchParams): Promise<T> {
  const run = async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = lastDocCall + (attempt ? 9000 * attempt : 5500) - Date.now();
      if (wait > 0) await sleep(wait);
      lastDocCall = Date.now();
      try {
        return await getJson<T>(`${DOC_API}?${qs}`, { timeoutMs: 25000 });
      } catch (e) {
        lastErr = e;
        if (!(e instanceof Error && /429|limit requests/i.test(e.message))) throw e;
      }
    }
    throw lastErr;
  };
  const p = docChain.then(run, run);
  docChain = p.catch(() => undefined);
  return p;
}

async function docQuery(params: Record<string, string>): Promise<DocArticle[]> {
  const qs = new URLSearchParams({ mode: 'artlist', format: 'json', sort: 'datedesc', ...params });
  const res = await docGet<{ articles?: DocArticle[] }>(qs);
  return res.articles ?? [];
}

export async function docTone(query: string, timespan = '30d'): Promise<{ date: string; value: number }[]> {
  const qs = new URLSearchParams({ query, mode: 'timelinetone', format: 'json', timespan });
  const res = await docGet<{ timeline?: { data?: { date: string; value: number }[] }[] }>(qs);
  return res.timeline?.[0]?.data ?? [];
}

const OUTLET_NAMES: Record<string, string> = {
  'sis.gov.eg': 'SIS', 'presidency.eg': 'Presidency of Egypt', 'mena.org.eg': 'MENA', 'english.ahram.org.eg': 'Ahram Online', 'ahram.org.eg': 'Al-Ahram',
  'reuters.com': 'Reuters', 'apnews.com': 'AP', 'aljazeera.com': 'Al Jazeera', 'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'thenationalnews.com': 'The National',
  'arabnews.com': 'Arab News', 'al-monitor.com': 'Al-Monitor', 'middleeasteye.net': 'Middle East Eye', 'bloomberg.com': 'Bloomberg', 'ft.com': 'Financial Times',
  'dailynewsegypt.com': 'Daily News Egypt', 'egyptindependent.com': 'Egypt Independent', 'egypttoday.com': 'Egypt Today', 'madamasr.com': 'Mada Masr',
};
export function outletName(domain: string): string {
  const d = domain.toLowerCase().replace(/^www\./, '');
  return OUTLET_NAMES[d] ?? OUTLET_NAMES[d.split('.').slice(-2).join('.')] ?? d;
}

function toRaw(a: DocArticle): RawItem {
  const domain = a.domain || new URL(a.url).hostname;
  return {
    title: a.title,
    summary: '',
    url: a.url,
    date: gdeltDate(a.seendate),
    sourceName: outletName(domain),
    kind: kindForDomain(domain),
    feed: 'gdelt-doc',
  };
}

export const gdeltDoc: SourceAdapter = {
  id: 'gdelt-doc',
  name: 'GDELT DOC 2.0 (global news)',
  method: 'JSON API, keyless; 4 Sisi history slices, Egyptian state/Ahram domain queries, theater queries; serialised at 5.5 s',
  async run() {
    const out: RawItem[] = [];
    const notes: string[] = [];
    const counts: string[] = [];
    const now = Date.now();
    const DAY = 86_400_000;
    // 90 days of Sisi coverage in slices so recent days don't crowd out history.
    const slices: [number, number, string][] = [[0, 10, '250'], [10, 30, '200'], [30, 60, '150'], [60, 92, '150']];
    for (const [from, to, max] of slices) {
      try {
        const arts = await docQuery({ query: `${SISI_Q} sourcelang:english`, startdatetime: stamp(new Date(now - to * DAY)), enddatetime: stamp(new Date(now - from * DAY)), maxrecords: max });
        out.push(...arts.map(toRaw));
        counts.push(`${from}-${to}d:${arts.length}`);
      } catch (e) {
        notes.push(`slice ${from}-${to}d: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      }
    }
    // Egyptian state outlets and Ahram sit behind Cloudflare challenges that
    // block datacenter IPs, so their English output is read through GDELT's
    // index of those domains instead.
    const domainQueries: [string, string][] = [
      ['sis', '(Sisi OR Egypt OR Egyptian OR Cairo) domain:sis.gov.eg'],
      ['presidency', 'domain:presidency.eg'],
      ['mena', '(Sisi OR Egypt OR Egyptian) domain:mena.org.eg'],
      ['ahram', '(Sisi OR Egypt OR Egyptian OR Cairo) domain:ahram.org.eg sourcelang:english'],
    ];
    for (const [label, q] of domainQueries) {
      try {
        const arts = await docQuery({ query: q, timespan: '30d', maxrecords: '150' });
        out.push(...arts.filter(a => !a.language || /english/i.test(a.language)).map(toRaw));
        counts.push(`${label}:${arts.length}`);
      } catch (e) {
        notes.push(`${label}: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      }
    }
    const theaterQueries = [
      '(Gaza OR Rafah) Egypt sourcelang:english',
      '(Libya OR Haftar OR Dbeibah OR Tripoli) sourcelang:english',
      '(Sudan OR RSF OR "El Fasher" OR Burhan) sourcelang:english',
      '("Suez Canal" OR "Red Sea" OR "Bab el-Mandeb" OR Houthi) (shipping OR vessel OR attack OR transit) sourcelang:english',
      '(Iran OR IRGC) (Egypt OR Gulf OR Saudi) sourcelang:english',
    ];
    for (const q of theaterQueries) {
      try {
        const arts = await docQuery({ query: q, timespan: '7d', maxrecords: '75' });
        out.push(...arts.map(toRaw));
        counts.push(`${q.slice(1, 8)}:${arts.length}`);
      } catch (e) {
        notes.push(`${q.slice(0, 20)}: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      }
    }
    return { items: out, note: [counts.join(' '), ...notes].join('; ') };
  },
};

/* ── GDELT 2.0 geocoded events (15-minute exports) ────────────────────── */

// Egypt, Libya, Sudan, Gaza, Red Sea, Gulf.
const MENA_BBOX: [number, number, number, number] = [9, 8, 60, 38];
const CAMEO_COUNTRIES = ['EGY', 'LBY', 'SDN', 'PSE', 'ISR', 'YEM', 'IRN', 'SAU', 'ARE', 'QAT'];
const GEO_THEATER_COUNTRIES: Record<string, string> = { EG: 'Egypt', LY: 'Libya', SU: 'Sudan', GZ: 'Gaza', IS: 'Israel', YM: 'Yemen', IR: 'Iran', SA: 'Saudi Arabia', AE: 'UAE', QA: 'Qatar' };

/** GDELT event root codes as plain-English verbs for synthetic headlines. */
const ROOT_VERB: Record<string, string> = {
  '01': 'public statement', '02': 'appeal', '03': 'intent to cooperate', '04': 'consultation', '05': 'diplomatic cooperation',
  '06': 'material cooperation', '07': 'aid', '08': 'concession', '09': 'investigation', '10': 'demand', '11': 'disapproval',
  '12': 'rejection', '13': 'threat', '14': 'protest', '15': 'force posture', '16': 'reduced relations', '17': 'coercion',
  '18': 'assault', '19': 'armed clash', '20': 'mass violence',
};

export interface GeoSignal { country: string; events: number; conflictShare: number; avgGoldstein: number; articles: number }

/** Last ingest's per-country GDELT intensity, used by the risk model. */
let lastGeoSignals: Record<string, GeoSignal> = {};
export const getLastGeoSignals = () => lastGeoSignals;

export const gdeltGeo: SourceAdapter = {
  id: 'gdelt-events',
  name: 'GDELT 2.0 geocoded events',
  method: 'Last 8 x 15-min export archives, MENA bounding box',
  async run() {
    const { events, windowsRead, scanned } = await fetchGdeltWindows({ windows: 8, bbox: MENA_BBOX, actorCountries: CAMEO_COUNTRIES, minArticles: 1 });
    // Intensity signals for the risk model (all quads).
    const sig: Record<string, { n: number; conflict: number; g: number; a: number }> = {};
    for (const e of events) {
      const k = e.country;
      if (!GEO_THEATER_COUNTRIES[k]) continue;
      const s = (sig[k] ||= { n: 0, conflict: 0, g: 0, a: 0 });
      s.n++;
      s.a += e.articles;
      s.g += e.goldstein;
      if (e.quad === 4) s.conflict += e.articles;
    }
    lastGeoSignals = Object.fromEntries(Object.entries(sig).map(([k, s]) => [k, { country: k, events: s.n, conflictShare: s.a ? s.conflict / s.a : 0, avgGoldstein: s.n ? s.g / s.n : 0, articles: s.a }]));

    // Only material-conflict events in the three theaters, well sourced,
    // become timeline items. Everything else feeds the risk model only.
    const theaterGeo = new Set(['LY', 'SU', 'GZ']);
    const picked = events
      .filter(e => e.quad === 4 && theaterGeo.has(e.country) && e.articles >= 3 && e.url)
      .sort((a, b) => b.articles - a.articles)
      .slice(0, 25);
    const byUrl = new Map<string, (typeof picked)[number]>();
    for (const e of picked) if (!byUrl.has(e.url)) byUrl.set(e.url, e);
    const items: RawItem[] = [...byUrl.values()].map(e => {
      const place = e.name.split(',')[0];
      const actors = [e.actor1, e.actor2].filter(Boolean).map(a => a.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(' / ');
      const verb = ROOT_VERB[e.root_code] ?? 'incident';
      const theater = e.country === 'LY' ? 'Libya' : e.country === 'SU' ? 'Sudan' : 'Gaza';
      let domain = 'GDELT';
      try { domain = new URL(e.url).hostname.replace(/^www\./, ''); } catch { /* keep */ }
      return {
        title: `${theater}: ${verb} reported near ${place}${actors ? ` (${actors})` : ''}`,
        summary: `GDELT-coded ${verb} event geolocated to ${e.name}, drawn from ${e.articles} article${e.articles === 1 ? '' : 's'} across ${e.sources} source${e.sources === 1 ? '' : 's'}. Goldstein score ${e.goldstein}. Machine-coded: open the source article before relying on it.`,
        url: e.url,
        date: e.date,
        sourceName: `GDELT via ${domain}`,
        kind: kindForDomain(domain),
        feed: 'gdelt-events',
        geo: { lat: e.lat, lng: e.lng, name: e.name },
        hint: { quad: e.quad, goldstein: e.goldstein, country: e.country },
      };
    });
    return { items, note: `${windowsRead} windows, ${scanned.toLocaleString()} rows scanned, ${events.length} in region` };
  },
};

/* ── International RSS (English) ──────────────────────────────────────── */

const NEWS_FEEDS: { name: string; url: string }[] = [
  { name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { name: 'Al-Monitor', url: 'https://www.al-monitor.com/rss' },
  { name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss' },
  { name: 'The National', url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml' },
  { name: 'Arab News', url: 'https://www.arabnews.com/rss.xml' },
];

const THEATER_WORDS = [...THEATER_TERMS.gaza, ...THEATER_TERMS.libya, ...THEATER_TERMS.sudan, ...THEATER_TERMS['red-sea'], ...THEATER_TERMS.gulf];

export const newsRss: SourceAdapter = {
  id: 'news-rss',
  name: 'International RSS (Al Jazeera, BBC, Al-Monitor, MEE, The National, Arab News)',
  method: 'RSS, filtered to Egypt / Sisi / tracked theaters',
  async run() {
    const results = await Promise.allSettled(NEWS_FEEDS.map(async f => ({ f, items: await readFeed(f.url, { timeoutMs: 12000 }) })));
    const out: RawItem[] = [];
    const notes: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        notes.push(`${NEWS_FEEDS[i].name}: ${r.reason instanceof Error ? r.reason.message.slice(0, 60) : r.reason}`);
        return;
      }
      let kept = 0;
      for (const it of r.value.items) {
        const text = `${it.title} ${it.summary}`;
        if (!EGYPT_RELEVANCE.test(text) && !THEATER_WORDS.some(w => hasTerm(text, w))) continue;
        out.push({ title: it.title, summary: it.summary, url: it.link, date: it.date, sourceName: r.value.f.name, kind: 'independent', feed: 'news-rss' });
        kept++;
      }
      notes.push(`${r.value.f.name}: ${kept}/${r.value.items.length}`);
    });
    return { items: out, note: notes.join('; ') };
  },
};
