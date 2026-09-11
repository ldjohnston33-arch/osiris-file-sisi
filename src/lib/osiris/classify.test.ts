import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import { mergeClusters, sourcingLabel } from './corroborate';
import { applyLinkage, applyTripContext, rankPartners } from './enrich';
import { readsAsQuote, houseStyle } from '@/lib/ai-engine';
import type { RawItem } from './types';

const now = new Date('2026-09-11T12:00:00Z');
const item = (title: string, o: Partial<RawItem> = {}): RawItem => ({
  title, summary: '', url: `https://example.test/${encodeURIComponent(title)}`, date: '2026-09-10T10:00:00Z',
  sourceName: 'example', kind: 'independent', feed: 'gdelt-doc', ...o,
});

describe('classify', () => {
  it.each([
    ['President El-Sisi arrives in India for BRICS summit', 'movement', 'IN'],
    ['President El-Sisi receives Chinese President Xi Jinping', 'inbound', 'CN'],
    ["China's Xi arrives in Cairo on first state visit in a decade", 'inbound', 'CN'],
    ['President El-Sisi receives phone call from Saudi Crown Prince Mohammed bin Salman', 'diplomatic', 'SA'],
    ['Sisi holds talks with US envoy Witkoff on Gaza ceasefire', 'inbound', 'US'],
  ])('%s → %s / %s', (title, category, partner) => {
    const e = classify(item(title), now);
    expect(e.category).toBe(category);
    expect(e.partner).toBe(partner);
  });

  it('places conflict items in their theater', () => {
    const e = classify(item('Israeli strikes kill 20 in Gaza despite ceasefire'), now);
    expect(e.category).toBe('conflict');
    expect(e.theaters).toContain('gaza');
  });

  it('routes Red Sea shipping to maritime', () => {
    const e = classify(item('Houthi missile strikes tanker in Red Sea near Bab el-Mandeb'), now);
    expect(e.category).toBe('maritime');
    expect(e.location.name).toBe('Bab el-Mandeb');
  });

  it('flags announced engagements as upcoming', () => {
    expect(classify(item('Sisi to visit Saudi Arabia next week for talks'), now).upcoming).toBe(true);
  });

  it('treats presidency copy about "the President" as Sisi', () => {
    const e = classify(item('The President inaugurates new projects in Aswan', { kind: 'state', feed: 'presidency-rss' }), now);
    expect(e.involvesSisi).toBe(true);
    expect(e.category).toBe('ceremonial');
  });
});

describe('sourcing tiers', () => {
  it('upgrades a state bulletin once an independent outlet matches it', () => {
    const merged = mergeClusters([
      classify(item('President El-Sisi arrives in India for BRICS summit', { kind: 'state', feed: 'presidency-rss', sourceName: 'Presidency', url: 'https://www.presidency.eg/a' }), now),
      classify(item("Egypt's Sisi arrives in New Delhi for BRICS summit", { sourceName: 'reuters.com', url: 'https://reuters.com/b', date: '2026-09-10T12:00:00Z' }), now),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source.tier).toBe('corroborated');
    expect(sourcingLabel(merged[0]).text).toBe('Independently corroborated');
  });

  it('keeps state-only items tagged as such', () => {
    const [e] = mergeClusters([classify(item('President El-Sisi receives Emir of Qatar', { kind: 'state', feed: 'sis-rss' }), now)]);
    expect(sourcingLabel(e).text).toBe('State source only');
  });
});

describe('enrichment', () => {
  it('moves meetings during a trip to the trip location', () => {
    const ev = applyTripContext(mergeClusters([
      classify(item('President El-Sisi arrives in India for BRICS summit', { date: '2026-09-11T06:00:00Z' }), now),
      classify(item('President El-Sisi meets Brazilian President Lula', { date: '2026-09-11T10:00:00Z', kind: 'state', feed: 'sis-rss' }), now),
    ]));
    const lula = ev.find(e => e.partner === 'BR')!;
    expect(lula.category).toBe('diplomatic');
    expect(lula.location.name).toBe('New Delhi');
  });

  it('links conflict items to Egyptian diplomacy on the same theater', () => {
    const ev = applyLinkage(mergeClusters([
      classify(item('Sisi receives Hamas and Israeli delegations in Cairo for Gaza ceasefire talks', { date: '2026-09-06T09:00:00Z' }), now),
      classify(item('Israeli strikes kill 20 in Gaza despite ceasefire', { date: '2026-09-08T09:00:00Z' }), now),
    ]));
    const c = ev.find(e => e.category === 'conflict')!;
    expect(c.linkageKind).toBe('dynamic');
    expect(c.diplomaticLinkage).toMatch(/Egyptian diplomatic track/);
  });

  it('ranks partners by in-person visits', () => {
    const ev = mergeClusters([
      classify(item('President El-Sisi receives Emir of Qatar', { date: '2026-08-20T09:00:00Z' }), now),
      classify(item('President El-Sisi receives Qatari Prime Minister', { date: '2026-09-01T09:00:00Z' }), now),
      classify(item('President El-Sisi arrives in Riyadh', { date: '2026-08-10T09:00:00Z' }), now),
    ]);
    const ranks = rankPartners(ev, now.getTime());
    expect(ranks[0].code).toBe('QA');
    expect(ranks[0].visitsIn).toBe(2);
  });
});

describe('Analyst Read guardrails', () => {
  it('rejects text that could read as his words', () => {
    expect(readsAsQuote('I will not allow displacement.')).toBe(true);
    expect(readsAsQuote('He said “no” to the plan.')).toBe(true);
    expect(readsAsQuote('Sisi believes the plan fails.')).toBe(true);
    expect(readsAsQuote('Pattern points to firm pushback, consistent with the October 2023 rejection of displacement.')).toBe(false);
  });
  it('strips em dashes', () => {
    expect(houseStyle('Cairo — as expected — held firm')).toBe('Cairo, as expected, held firm');
  });
});
