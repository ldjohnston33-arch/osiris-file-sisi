/**
 * Egyptian state sources: Presidency (Ittihadiya press office), State
 * Information Service, Middle East News Agency. Items from these are tagged
 * kind: 'state' and render as "State source only" until an independent outlet
 * is matched to them.
 *
 * Each adapter tries its RSS feed first and falls back to parsing the public
 * listing page. Which path actually works is reported on /api/ingest/health
 * and documented in the README.
 */

import type { RawItem } from '../types';
import { getText, mapLimit } from '../http';
import {
  extractDescription, extractLinks, extractPublishedDate, extractTitle,
  firstWorking, isArabic, readFeed, type SourceAdapter,
} from './common';
import { SIS_EXTRA_CA } from './sis-ca';

const enc = (s: string) => encodeURI(s);

/* ── Presidency of the Arab Republic of Egypt (presidency.eg) ─────────── */

// The RSS index at /en/rss/ lists four feeds under Arabic slugs. English
// listing pages share the same slugs under /en/.
const PRESIDENCY_FEEDS = [
  'https://www.presidency.eg/en/الأخبار-الرئاسية/',
  'https://www.presidency.eg/en/rss-الأحداث/',
  'https://www.presidency.eg/الأخبار-الرئاسية/',
  'https://www.presidency.eg/rss-الأحداث/',
].map(enc);

const PRESIDENCY_LISTINGS = [
  'https://www.presidency.eg/en/قسم-الأخبار/أخبار-رئاسية/',
  'https://www.presidency.eg/en/قسم-الأخبار/الفعاليات-والمؤتمرات/',
].map(enc);

/** Presidency article slugs embed the date: news11102025-2, speeches-18102023. */
export function dateFromPresidencySlug(url: string): string | undefined {
  const m = decodeURI(url).match(/\/(?:news|speeches?|event|events|statement)[-_]?(\d{2})(\d{2})(\d{4})(?:-\d+)?\/?$/i);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}T10:00:00Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

export const presidency: SourceAdapter = {
  id: 'presidency',
  name: 'Presidency of Egypt (Ittihadiya)',
  method: 'RSS, falling back to English news listing',
  async run() {
    const items: RawItem[] = [];
    let note = '';
    try {
      const { url, items: feed } = await firstWorking(PRESIDENCY_FEEDS, u => readFeed(u, { browserUa: true }));
      for (const f of feed) {
        if (isArabic(f.title)) continue;
        items.push({ title: f.title, summary: f.summary, url: f.link, date: f.date || dateFromPresidencySlug(f.link) || '', sourceName: 'Presidency of Egypt', kind: 'state', feed: 'presidency-rss' });
      }
      note = `RSS: ${decodeURI(url)} (${feed.length} items, ${items.length} English)`;
    } catch (e) {
      note = `RSS unavailable (${e instanceof Error ? e.message.slice(0, 120) : e}); `;
    }
    if (items.length === 0) {
      for (const listing of PRESIDENCY_LISTINGS) {
        try {
          const html = await getText(listing, { browserUa: true, timeoutMs: 15000 });
          const links = extractLinks(html, listing, /\/en\/.*(?:news|speech|event|statement)[^/]*\/?$/i).slice(0, 25);
          for (const l of links) {
            if (isArabic(l.text)) continue;
            items.push({ title: l.text, summary: '', url: l.url, date: dateFromPresidencySlug(l.url) || '', sourceName: 'Presidency of Egypt', kind: 'state', feed: 'presidency-html' });
          }
        } catch (e) {
          note += ` listing ${decodeURI(listing).split('/').slice(-2, -1)[0]} failed: ${e instanceof Error ? e.message.slice(0, 80) : e};`;
        }
      }
      // Listing pages carry no summary; read the article meta for the newest.
      await mapLimit(items.filter(i => !i.summary).slice(0, 12), 4, async it => {
        try {
          const html = await getText(it.url, { browserUa: true, timeoutMs: 12000 });
          it.summary = extractDescription(html);
          it.date = it.date || extractPublishedDate(html) || '';
        } catch { /* keep headline-only */ }
      });
      if (items.length) note += ` HTML listing: ${items.length} items`;
    }
    return { items: items.filter(i => i.date), note: note.trim() };
  },
};

/* ── State Information Service (sis.gov.eg) ───────────────────────────── */

const SIS_FEEDS = [
  'https://sis.gov.eg/en/feed/',
  'https://www.sis.gov.eg/en/feed/',
  'https://sis.gov.eg/en/media-center/news/feed/',
];
const SIS_LISTINGS = ['https://sis.gov.eg/en/media-center/news/', 'https://www.sis.gov.eg/en/media-center/news/'];

export const sis: SourceAdapter = {
  id: 'sis',
  name: 'State Information Service (SIS)',
  method: 'RSS, falling back to /en/media-center/news/ listing',
  async run() {
    const opts = { browserUa: true, extraCa: SIS_EXTRA_CA, timeoutMs: 15000 };
    try {
      const { url, items } = await firstWorking(SIS_FEEDS, u => readFeed(u, opts));
      const out = items.filter(f => !isArabic(f.title)).map<RawItem>(f => ({
        title: f.title, summary: f.summary, url: f.link, date: f.date, sourceName: 'SIS', kind: 'state', feed: 'sis-rss',
      }));
      return { items: out, note: `RSS: ${url} (${out.length} items)` };
    } catch (rssErr) {
      const { url, items: links } = await firstWorking(SIS_LISTINGS, async u => {
        const html = await getText(u, opts);
        return extractLinks(html, u, /\/en\/media-center\/news\/[^/?#]+\/?$/i);
      });
      const top = links.filter(l => !isArabic(l.text)).slice(0, 20);
      const out: RawItem[] = await mapLimit(top, 4, async l => {
        let summary = '', date = '', title = l.text;
        try {
          const html = await getText(l.url, opts);
          summary = extractDescription(html);
          date = extractPublishedDate(html) || '';
          title = extractTitle(html).replace(/\s*[-|–]\s*SIS.*$/i, '') || l.text;
        } catch { /* headline only */ }
        return { title, summary, url: l.url, date, sourceName: 'SIS', kind: 'state' as const, feed: 'sis-html' };
      });
      return {
        items: out.filter(i => i.date),
        note: `RSS failed (${rssErr instanceof Error ? rssErr.message.slice(0, 100) : rssErr}); HTML listing ${url}: ${out.length} items`,
      };
    }
  },
};

/* ── Middle East News Agency (mena.org.eg) ────────────────────────────── */

const MENA_FEEDS = ['https://www.mena.org.eg/en/rss', 'https://www.mena.org.eg/rss/en', 'https://www.mena.org.eg/en/feed'];
const MENA_LISTINGS = ['https://www.mena.org.eg/en', 'https://www.mena.org.eg/en/news'];

export const mena: SourceAdapter = {
  id: 'mena',
  name: 'Middle East News Agency (MENA)',
  method: 'RSS, falling back to English homepage listing',
  async run() {
    try {
      const { url, items } = await firstWorking(MENA_FEEDS, u => readFeed(u, { browserUa: true }));
      const out = items.filter(f => !isArabic(f.title)).map<RawItem>(f => ({
        title: f.title, summary: f.summary, url: f.link, date: f.date, sourceName: 'MENA', kind: 'state', feed: 'mena-rss',
      }));
      return { items: out, note: `RSS: ${url}` };
    } catch (rssErr) {
      const { url, items: links } = await firstWorking(MENA_LISTINGS, async u => {
        const html = await getText(u, { browserUa: true, timeoutMs: 15000 });
        return extractLinks(html, u, /\/en\/news\/.+/i);
      });
      const top = links.filter(l => !isArabic(l.text)).slice(0, 15);
      const out: RawItem[] = await mapLimit(top, 4, async l => {
        let summary = '', date = '';
        try {
          const html = await getText(l.url, { browserUa: true, timeoutMs: 12000 });
          summary = extractDescription(html);
          date = extractPublishedDate(html) || '';
        } catch { /* headline only */ }
        return { title: l.text, summary, url: l.url, date, sourceName: 'MENA', kind: 'state' as const, feed: 'mena-html' };
      });
      return { items: out.filter(i => i.date), note: `RSS failed (${rssErr instanceof Error ? rssErr.message.slice(0, 100) : rssErr}); HTML ${url}: ${out.length}` };
    }
  },
};
