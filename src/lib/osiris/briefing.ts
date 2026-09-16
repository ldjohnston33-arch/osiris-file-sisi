/**
 * The dossier's short briefing paragraph.
 *
 * Generated once per ingest (every ~30 minutes), never per view. With a
 * Gemini key it is a model-written paragraph over the latest events; without
 * one, a deterministic summary assembled from the same data.
 */

import type { Briefing, OsirisEvent, PartnerRank, RiskBreakdown } from './types';
import { aiEnabled, generateJson, houseStyle } from '@/lib/ai-engine';
import { countryName } from './gazetteer';

const DAY = 86_400_000;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' });

const SYSTEM = `You are the editorial analyst for L4 Global's Osiris File on Egyptian President Abdel Fattah el-Sisi.
Write a short briefing on the last seven days from the supplied events only, formatted as light markdown for a dashboard card:
- 2-3 short "## " headings grouping the material by theme (choose from: Travel, Diplomatic Activity, Regional Files, Risk — use only the ones that have real content, skip the rest).
- Under each heading, 1-2 short sentences, not a wall of text.
- Bold the load-bearing facts with **double asterisks**: country/person names, dates, scores, counts.
Rules: lead with the most consequential development and why it matters for Egypt. Reference concrete events with dates. Direct, assertive, pragmatic tone; no throat-clearing. No em dashes. No quotation marks and no invented statements: describe what he did or what the record shows, never what he thinks. Do not use negative-contrast constructions ("not X but Y"). Keep the whole thing under 140 words.
Return JSON: {"briefing":"<markdown>"}`;

export function rulesBriefing(events: OsirisEvent[], partners: PartnerRank[], risk: RiskBreakdown[], now = Date.now()): Briefing {
  const week = events.filter(e => Date.parse(e.date) >= now - 7 * DAY && Date.parse(e.date) <= now + DAY && !e.upcoming);
  const trips = week.filter(e => e.category === 'movement' && e.involvesSisi && e.partner);
  const inbound = week.filter(e => e.category === 'inbound' && e.contactType === 'visit');
  const conflict = week.filter(e => e.category === 'conflict');
  const maritime = week.filter(e => e.category === 'maritime');
  const eg = risk.find(r => r.code === 'EG');
  const sections: string[] = [];

  const travel: string[] = [];
  if (trips.length) {
    const places = [...new Set(trips.map(t => t.location.name))].slice(0, 3);
    travel.push(`Over the past week Sisi's travel took him to **${places.join('**, **')}**, most recently on **${fmtDay(trips[0].date)}**.`);
  } else {
    travel.push("Sisi has made no tracked foreign trips in the past week.");
  }
  if (inbound.length) {
    const who = [...new Set(inbound.map(i => i.partner).filter(Boolean) as string[])].slice(0, 4).map(countryName);
    travel.push(`Cairo received **${inbound.length}** foreign visit${inbound.length > 1 ? 's' : ''}${who.length ? `, including delegations from **${who.join('**, **')}**` : ''}.`);
  }
  sections.push(`## Travel\n${travel.join(' ')}`);

  const theaterCounts: Record<string, number> = {};
  for (const c of [...conflict, ...maritime]) for (const t of c.theaters) theaterCounts[t] = (theaterCounts[t] ?? 0) + 1;
  const busiest = Object.entries(theaterCounts).sort((a, b) => b[1] - a[1])[0];
  const regional: string[] = [];
  if (busiest) {
    const label: Record<string, string> = { gaza: 'Gaza', libya: 'Libya', sudan: 'Sudan', gulf: 'the Gulf war', 'red-sea': 'Red Sea shipping', nile: 'the Nile file', horn: 'the Horn of Africa' };
    regional.push(`**${label[busiest[0]] ?? busiest[0]}** generated the most regional activity in the tracker (**${busiest[1]}** item${busiest[1] === 1 ? '' : 's'}).`);
  }
  if (partners[0]) regional.push(`Over 90 days, **${partners[0].name}** remains the most engaged partner by visit count.`);
  if (regional.length) sections.push(`## Regional Files\n${regional.join(' ')}`);

  if (eg) sections.push(`## Risk\nL4's composite reading for **Egypt** stands at **${eg.score}/100** (${eg.level.toLowerCase()}).`);

  return { text: sections.join('\n\n'), method: 'rules', generatedAt: new Date(now).toISOString() };
}

export async function makeBriefing(events: OsirisEvent[], partners: PartnerRank[], risk: RiskBreakdown[], now = Date.now()): Promise<{ briefing: Briefing; error?: string }> {
  const fallback = rulesBriefing(events, partners, risk, now);
  if (!aiEnabled()) return { briefing: fallback };
  const week = events
    .filter(e => Date.parse(e.date) >= now - 7 * DAY && Date.parse(e.date) <= now + DAY)
    .sort((a, b) => Number(b.involvesSisi) - Number(a.involvesSisi) || b.independentCount - a.independentCount)
    .slice(0, 30)
    .map(e => ({ date: e.date.slice(0, 10), category: e.category, title: e.title, sourcing: e.source.tier, where: e.location.name }));
  const prompt = JSON.stringify({ today: new Date(now).toISOString().slice(0, 10), events: week, topPartners90d: partners.slice(0, 5).map(p => `${p.name} (${p.total} visits)`), egyptRisk: risk.find(r => r.code === 'EG')?.score });
  try {
    const { data, model } = await generateJson<{ briefing?: string }>(SYSTEM, prompt, 1200);
    const text = houseStyle(data.briefing ?? '');
    if (text.length < 80 || /[“”"]/.test(text) || /\b(I|we|our)\b/.test(text)) return { briefing: fallback, error: 'AI briefing failed validation' };
    return { briefing: { text, method: 'gemini', generatedAt: new Date(now).toISOString(), model } };
  } catch (e) {
    return { briefing: fallback, error: e instanceof Error ? e.message.slice(0, 160) : String(e) };
  }
}
