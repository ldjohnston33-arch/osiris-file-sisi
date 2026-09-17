/**
 * De-duplication and sourcing tiers.
 *
 * Items about the same happening (a Presidency bulletin, the Ahram write-up,
 * a Reuters wire picked up by GDELT) are clustered and merged into one event
 * that lists every source. The sourcing tier then follows from the merged
 * source list:
 *   state        — only Egyptian state outlets carried it
 *   corroborated — at least one independent outlet carried it too
 */

import type { OsirisEvent, SourceRef } from './types';

const STOP = new Set(('the a an and or of to in on for with at by from as is are was were be been his her its their this that ' +
  'after over amid into about president egyptian egypt egypt’s egypt\'s sisi el-sisi al-sisi sissi abdel fattah says said new ' +
  'during talks meets meeting receives discuss discusses discussed two both').split(' '));

export function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[’']/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => w.length >= 3 && !STOP.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const HOURS = 3_600_000;

function sameHappening(a: OsirisEvent, b: OsirisEvent, ta: Set<string>, tb: Set<string>) {
  const dt = Math.abs(Date.parse(a.date) - Date.parse(b.date));
  if (dt > 48 * HOURS) return false;
  // Same visit: same partner, same direction, within two days.
  if (a.partner && a.partner === b.partner && a.category === b.category && (a.category === 'movement' || a.category === 'inbound') && dt <= 48 * HOURS) {
    return true;
  }
  const sim = jaccard(ta, tb);
  if (sim >= 0.42) return true;
  // Looser title match when entities also agree.
  const sharedEntity = a.relatedEntities.some(e => b.relatedEntities.includes(e));
  return sim >= 0.3 && sharedEntity && dt <= 30 * HOURS;
}

/** Which record should represent a merged cluster. */
function primaryRank(e: OsirisEvent): number {
  let r = 0;
  // Official record is the canonical account of what Sisi did.
  if (e.sources[0]?.kind === 'state') r += 4;
  if (e.sources[0]?.feed === 'presidency-rss' || e.sources[0]?.feed === 'presidency-html') r += 2;
  if (e.summary && e.summary !== e.title) r += 2;
  if (e.category === 'movement' || e.category === 'inbound') r += 1;
  if (e.sources[0]?.feed === 'gdelt-events') r -= 3;
  return r;
}

export function mergeClusters(events: OsirisEvent[]): OsirisEvent[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const toks = sorted.map(e => tokens(e.title));
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  for (let i = 0; i < sorted.length; i++) {
    const ti = Date.parse(sorted[i].date);
    for (let j = i + 1; j < sorted.length; j++) {
      if (Date.parse(sorted[j].date) - ti > 48 * HOURS) break;
      if (sameHappening(sorted[i], sorted[j], toks[i], toks[j])) parent[find(j)] = find(i);
    }
  }

  const groups = new Map<number, OsirisEvent[]>();
  sorted.forEach((e, i) => {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(e);
  });

  const merged: OsirisEvent[] = [];
  for (const group of groups.values()) {
    const primary = [...group].sort((a, b) => primaryRank(b) - primaryRank(a))[0];
    const seen = new Set<string>();
    const sources: SourceRef[] = [];
    for (const e of group) {
      for (const s of e.sources) {
        const key = s.url.replace(/[?#].*$/, '').replace(/\/$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(s);
      }
    }
    // State sources first, then independents by outlet name.
    sources.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'state' ? -1 : 1));
    const independentOutlets = new Set(sources.filter(s => s.kind === 'independent').map(s => s.name));
    const hasState = sources.some(s => s.kind === 'state');
    const lead = hasState ? sources.find(s => s.kind === 'state')! : sources[0];
    merged.push({
      ...primary,
      // Earliest report dates the event.
      date: group.reduce((m, e) => (Date.parse(e.date) < Date.parse(m) ? e.date : m), primary.date),
      relatedEntities: [...new Set(group.flatMap(e => e.relatedEntities))],
      theaters: [...new Set(group.flatMap(e => e.theaters))],
      involvesSisi: group.some(e => e.involvesSisi),
      upcoming: group.every(e => e.upcoming) || undefined,
      sources,
      independentCount: independentOutlets.size,
      source: { name: lead.name, url: lead.url, tier: independentOutlets.size > 0 ? 'corroborated' : 'state' },
      firstSeen: group.reduce((m, e) => (e.firstSeen < m ? e.firstSeen : m), primary.firstSeen),
      // A one-time Gemini polish must survive dedup even when the freshly
      // refetched duplicate (not the historical, already-polished one) wins
      // primaryRank — otherwise "one pass, ever" silently reverts every time
      // this happening gets re-clustered against a same-day refetch.
      analystRead: group.map(e => e.analystRead).find(r => r?.method === 'gemini') ?? primary.analystRead,
    });
  }
  return merged.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Label for the sourcing tag on every card. */
export function sourcingLabel(e: Pick<OsirisEvent, 'source' | 'sources' | 'independentCount'>): { text: string; tone: 'state' | 'corroborated' | 'single' } {
  const hasState = e.sources.some(s => s.kind === 'state');
  if (e.source.tier === 'state') return { text: 'State source only', tone: 'state' };
  if (hasState || e.independentCount >= 2) return { text: 'Independently corroborated', tone: 'corroborated' };
  return { text: 'Independent report (single outlet)', tone: 'single' };
}
