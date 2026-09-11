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

import type { RiskBreakdown } from './types';
import type { GeoSignal } from './sources/independent';

export const STRUCTURAL: Record<string, { name: string; base: number; tags: string[]; gdelt: string; neighbours: string[] }> = {
  EG: { name: 'Egypt', base: 45, tags: ['IMF programme', 'FX pressure', 'Gulf-war exposure', 'Red Sea revenue loss', 'regional spillover'], gdelt: 'EG', neighbours: ['LY', 'SU', 'GZ'] },
  LY: { name: 'Libya', base: 72, tags: ['divided government', 'militia control', 'oil blockade risk'], gdelt: 'LY', neighbours: ['EG', 'SU'] },
  SD: { name: 'Sudan', base: 84, tags: ['active civil war', 'humanitarian crisis', 'parallel authorities'], gdelt: 'SU', neighbours: ['EG', 'LY'] },
};

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
    return { code, name: s.name, score, level: level(score), components, tags: s.tags };
  });
}
