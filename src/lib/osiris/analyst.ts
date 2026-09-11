/**
 * "Analyst Read: How this likely fits his pattern"
 *
 * A labeled analytical inference attached to live events that bear on Sisi.
 * It is never phrased as his words. Every read carries its basis: the dated,
 * sourced position records from src/config/positions.ts and, when the store
 * has one, a comparable earlier event he handled.
 *
 * Rules produce a read for every eligible event. When a Gemini key is set, the
 * top few reads per ingest are rewritten into tighter prose in one batched
 * call; the rewrite is validated and discarded if it reads like a quote.
 */

import type { AnalystRead, OsirisEvent, PositionBasis } from './types';
import { POSITIONS, THEATER_THEMES, THEME_POSTURE, type Theme } from '@/config/positions';
import { hasTerm } from './gazetteer';
import { aiEnabled, generateJson, houseStyle, readsAsQuote } from '@/lib/ai-engine';

const DAY = 86_400_000;

export function themesFor(e: OsirisEvent): Theme[] {
  const themes = new Set<Theme>();
  for (const th of e.theaters) THEATER_THEMES[th].forEach(x => themes.add(x));
  const text = `${e.title} ${e.summary}`;
  for (const [theme, def] of Object.entries(THEME_POSTURE) as [Theme, (typeof THEME_POSTURE)[Theme]][]) {
    if (def.keywords.some(k => hasTerm(text, k))) themes.add(theme);
  }
  // Theater themes first: they are the more specific pattern.
  const ordered = [...themes];
  ordered.sort((a, b) => Number(!THEME_POSTURE[a].theater) - Number(!THEME_POSTURE[b].theater));
  return ordered;
}

function isEligible(e: OsirisEvent, now: number) {
  if (Date.parse(e.date) < now - 21 * DAY) return false;
  if (!['conflict', 'maritime', 'diplomatic', 'movement', 'inbound', 'economic'].includes(e.category)) return false;
  return e.involvesSisi || e.theaters.length > 0;
}

function basisFor(theme: Theme): PositionBasis[] {
  return POSITIONS.filter(p => p.theme === theme)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(p => ({ id: p.id, label: p.label, date: p.date, sourceName: p.sourceName, sourceUrl: p.sourceUrl }));
}

export function rulesRead(e: OsirisEvent, all: OsirisEvent[], now = Date.now()): AnalystRead | undefined {
  if (!isEligible(e, now)) return undefined;
  const themes = themesFor(e);
  if (!themes.length) return undefined;
  const theme = themes[0];
  const basis = basisFor(theme);
  if (!basis.length) return undefined;
  const et = Date.parse(e.date);
  const comparable = all
    .filter(o => o.id !== e.id && o.involvesSisi && Date.parse(o.date) < et - 2 * DAY && themesFor(o).includes(theme) && ['diplomatic', 'movement', 'inbound'].includes(o.category))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  return {
    posture: THEME_POSTURE[theme].posture,
    basis,
    comparable: comparable && { id: comparable.id, title: comparable.title, date: comparable.date },
    method: 'rules',
    generatedAt: new Date(now).toISOString(),
  };
}

const SYSTEM = `You write the "Analyst Read" notes for Osiris File, an open-source intelligence profile of Egyptian President Abdel Fattah el-Sisi published by L4 Global.

Each note is a labeled analytical inference about how a live event likely fits his established pattern. Hard rules:
- Third person only. Never write in his voice, never use first-person pronouns, never use quotation marks, never attribute words, thoughts or feelings to him.
- Base the inference only on the basis records and comparable event supplied. Cite at least one basis record by its month and year in the text (e.g. "consistent with the June 2020 Sirte–Jufra declaration").
- Frame it as likelihood ("likely", "pattern points to", "expect"). Two or three sentences, under 70 words.
- No em dashes. Direct, pragmatic tone. No hedging beyond the likelihood framing.
Return JSON: {"reads":[{"id":"<event id>","posture":"<text>"}]}`;

/** Rewrites the top reads with Gemini in a single call. Mutates `events`. */
export async function polishReads(events: OsirisEvent[], limit = 6): Promise<{ polished: number; model?: string; error?: string }> {
  if (!aiEnabled()) return { polished: 0 };
  const targets = events
    .filter(e => e.analystRead)
    .sort((a, b) => Number(b.involvesSisi) - Number(a.involvesSisi) || Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limit);
  if (!targets.length) return { polished: 0 };
  const prompt = JSON.stringify(targets.map(e => ({
    id: e.id,
    event: { date: e.date.slice(0, 10), title: e.title, summary: e.summary.slice(0, 300), category: e.category },
    basis: e.analystRead!.basis.map(b => ({ date: b.date, record: b.label, source: b.sourceName })),
    comparable: e.analystRead!.comparable ? { date: e.analystRead!.comparable.date.slice(0, 10), title: e.analystRead!.comparable.title } : null,
    patternSummary: e.analystRead!.posture,
  })), null, 1);
  try {
    const { data, model } = await generateJson<{ reads?: { id: string; posture: string }[] }>(SYSTEM, prompt, 3000);
    let polished = 0;
    for (const r of data.reads ?? []) {
      const e = targets.find(t => t.id === r.id);
      if (!e || !r.posture) continue;
      const text = houseStyle(r.posture);
      if (text.length > 600 || readsAsQuote(text)) continue;
      e.analystRead = { ...e.analystRead!, posture: text, method: 'gemini' };
      polished++;
    }
    return { polished, model };
  } catch (err) {
    return { polished: 0, error: err instanceof Error ? err.message.slice(0, 160) : String(err) };
  }
}
