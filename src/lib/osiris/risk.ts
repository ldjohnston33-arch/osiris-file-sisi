/**
 * L4 composite country risk (experimental), shown on the dossier.
 *
 * Replaces Osiris's /api/country-risk table, which used static scores, had no
 * Egypt entry and matched earthquakes to countries by substring. Here every
 * score is a weighted sum of four visible components:
 *
 *   structural  55%  editorial baseline, documented tags (edit below)
 *   conflict    20%  GDELT material-conflict share of article volume, last ~2h
 *   tone        15%  GDELT DOC average media tone, last 7 days
 *   spillover   10%  conflict intensity in neighbouring theaters
 *
 * A live component that fails to load falls back to the structural value and
 * says so in its note, so the score never silently jumps.
 */

import type { RiskBreakdown, RiskContext } from './types';
import type { GeoSignal } from './sources/independent';

export const STRUCTURAL: Record<string, { name: string; base: number; tags: string[]; gdelt: string; neighbours: string[] }> = {
  EG: { name: 'Egypt', base: 45, tags: ['IMF programme', 'FX pressure', 'Gulf-war exposure', 'Red Sea revenue loss', 'regional spillover'], gdelt: 'EG', neighbours: ['LY', 'SU', 'GZ'] },
  LY: { name: 'Libya', base: 72, tags: ['divided government', 'militia control', 'oil blockade risk'], gdelt: 'LY', neighbours: ['EG', 'SU'] },
  SD: { name: 'Sudan', base: 84, tags: ['active civil war', 'humanitarian crisis', 'parallel authorities'], gdelt: 'SU', neighbours: ['EG', 'LY'] },
};

/**
 * Static comparison set for percentile/quartile context on the Egypt score.
 * These are editorial baselines only (no live GDELT tracking for the ones
 * Egypt/Libya/Sudan don't already cover) — the same 20-country structural
 * table this tool inherited from upstream Osiris's country-risk index,
 * which itself had no Egypt entry. Kept static and separate from STRUCTURAL
 * so widening the comparison set never multiplies live API calls.
 */
export const COMPARISON_BASELINE: Record<string, { name: string; base: number }> = {
  UA: { name: 'Ukraine', base: 85 },
  RU: { name: 'Russia', base: 72 },
  IL: { name: 'Israel', base: 78 },
  PS: { name: 'Palestinian Territories', base: 90 },
  SY: { name: 'Syria', base: 82 },
  YE: { name: 'Yemen', base: 88 },
  MM: { name: 'Myanmar', base: 76 },
  SD: { name: 'Sudan', base: 84 },
  AF: { name: 'Afghanistan', base: 80 },
  KP: { name: 'North Korea', base: 70 },
  IR: { name: 'Iran', base: 68 },
  CN: { name: 'China', base: 35 },
  TW: { name: 'Taiwan', base: 45 },
  VE: { name: 'Venezuela', base: 60 },
  HT: { name: 'Haiti', base: 85 },
  LB: { name: 'Lebanon', base: 65 },
  PK: { name: 'Pakistan', base: 55 },
  SO: { name: 'Somalia', base: 82 },
  LY: { name: 'Libya', base: 72 },
  ET: { name: 'Ethiopia', base: 62 },
};

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

/** Positions `score` against the static comparison set (mean/median/quartiles/percentile). */
export function riskContext(score: number): RiskContext {
  const scores = Object.values(COMPARISON_BASELINE).map(c => c.base).sort((a, b) => a - b);
  const n = scores.length;
  const mean = Math.round(scores.reduce((s, x) => s + x, 0) / n);
  const below = scores.filter(s => s < score).length;
  return {
    n,
    mean,
    median: Math.round(quantile(scores, 0.5)),
    q1: Math.round(quantile(scores, 0.25)),
    q3: Math.round(quantile(scores, 0.75)),
    min: scores[0],
    max: scores[n - 1],
    percentile: Math.round((below / n) * 100),
  };
}

const W = { structural: 0.55, conflict: 0.2, tone: 0.15, spillover: 0.1 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const level = (s: number): RiskBreakdown['level'] => (s >= 80 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 40 ? 'ELEVATED' : 'LOW');

export function conflictScore(sig?: GeoSignal): number | undefined {
  if (!sig || sig.articles < 5) return undefined;
  return clamp(Math.round(sig.conflictShare * 250));
}

export function toneScore(tone?: number): number | undefined {
  if (tone === undefined || Number.isNaN(tone)) return undefined;
  return clamp(Math.round(-tone * 12));
}

export function computeRisk(signals: Record<string, GeoSignal>, tones: Record<string, number | undefined>): RiskBreakdown[] {
  return Object.entries(STRUCTURAL).map(([code, s]) => {
    const c = conflictScore(signals[s.gdelt]);
    const t = toneScore(tones[code]);
    const neighbourScores = s.neighbours.map(n => conflictScore(signals[n])).filter((x): x is number => x !== undefined);
    const sp = neighbourScores.length ? Math.max(...neighbourScores) : undefined;
    const sig = signals[s.gdelt];
    const components = [
      { key: 'structural', label: 'Structural baseline', value: s.base, weight: W.structural, note: `Editorial baseline: ${s.tags.join(', ')}` },
      {
        key: 'conflict', label: 'Live conflict intensity', value: c ?? s.base, weight: W.conflict,
        note: c === undefined ? 'No usable GDELT volume this refresh; held at baseline' : `${Math.round((sig?.conflictShare ?? 0) * 100)}% of ${sig?.articles} GDELT-coded articles describe material conflict`,
      },
      {
        key: 'tone', label: 'Media tone (7d)', value: t ?? s.base, weight: W.tone,
        note: t === undefined ? 'GDELT tone unavailable; held at baseline' : `Average GDELT tone ${tones[code]!.toFixed(2)} (more negative = higher risk)`,
      },
      {
        key: 'spillover', label: 'Neighbour spillover', value: sp ?? s.base, weight: W.spillover,
        note: sp === undefined ? 'No neighbour signal this refresh; held at baseline' : `Highest conflict intensity among ${s.neighbours.join(', ').replace('SU', 'Sudan').replace('GZ', 'Gaza').replace('LY', 'Libya').replace('EG', 'Egypt')}`,
      },
    ];
    const score = Math.round(components.reduce((sum, x) => sum + x.value * x.weight, 0));
    const context = code === 'EG' ? riskContext(score) : undefined;
    return { code, name: s.name, score, level: level(score), components, tags: s.tags, context };
  });
}
