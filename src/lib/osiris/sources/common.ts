import Parser from 'rss-parser';
import type { RawItem } from '../types';
import { getText, type GetOptions } from '../http';

export interface SourceAdapter {
  id: string;
  name: string;
  /** Short note for the health page: which access method this adapter uses. */
  method: string;
  run(): Promise<{ items: RawItem[]; note?: string }>;
}

const parser = new Parser({ timeout: 15000 });

export interface FeedItem {
  title: string;
  link: string;
  date: string;
  summary: string;
}

export async function readFeed(url: string, opts: GetOptions = {}): Promise<FeedItem[]> {
  const xml = await getText(url, { timeoutMs: 15000, ...opts, headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*', ...opts.headers } });
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml.slice(0, 2000))) {
    throw new Error(`${new URL(url).hostname}: not an RSS/Atom document`);
  }
  const feed = await parser.parseString(xml);
  return (feed.items || []).map(i => ({
    title: (i.title || '').trim(),
    link: (i.link || i.guid || '').trim(),
    date: i.isoDate || i.pubDate || '',
    summary: (i.contentSnippet || i.summary || i.content || '').trim(),
  })).filter(i => i.title && i.link);
}

/** Tries candidate URLs in order and returns the first that yields items. */
export async function firstWorking<T>(candidates: string[], fn: (url: string) => Promise<T[]>): Promise<{ url: string; items: T[] }> {
  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const items = await fn(url);
      if (items.length) return { url, items };
      errors.push(`${url}: 0 items`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(' | '));
}

/** Pulls <a href> + text pairs matching an href pattern out of listing HTML. */
export function extractLinks(html: string, base: string, hrefPattern: RegExp): { url: string; text: string }[] {
  const out = new Map<string, string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!hrefPattern.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 25) continue;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!out.has(abs) || (out.get(abs)!.length < text.length)) out.set(abs, text);
  }
  return [...out].map(([url, text]) => ({ url, text }));
}

/** Reads common article-date metadata from an article page. */
export function extractPublishedDate(html: string): string | undefined {
  const pats = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /<meta[^>]+name=["'](?:date|pubdate|publishdate)["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m && !Number.isNaN(Date.parse(m[1]))) return new Date(m[1]).toISOString();
  }
  return undefined;
}

export function extractDescription(html: string): string {
  const m =
    html.match(/<meta[^>]+(?:name|property)=["'](?:og:description|description)["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:og:description|description)["']/i);
  return m ? m[1] : '';
}

export function extractTitle(html: string): string {
  const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Whether a headline is in Arabic script (the English classifier skips these). */
export const isArabic = (s: string) => /[؀-ۿ]/.test(s) && !/[A-Za-z]{4,}/.test(s);

export const EGYPT_RELEVANCE = /\b(egypt|egyptian|cairo|sisi|el-sisi|al-sisi|sissi|suez|sinai|rafah|abdelatty|abdel ?atty|madbouly)\b/i;
