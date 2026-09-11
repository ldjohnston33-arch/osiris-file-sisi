'use client';

import { useMemo, useState } from 'react';
import type { Store, Theater } from '@/lib/osiris/types';
import { countryName } from '@/lib/osiris/gazetteer';
import { THEATER_LABEL, fmtShort, daysBetween } from '@/lib/osiris/ui';

const DAY = 86_400_000;
const WATCH = ['US', 'SA', 'AE', 'QA', 'TR', 'CN', 'PS', 'JO', 'EU', 'FR', 'IN', 'RU'];

export default function StatTiles({ store, now, analystMode }: { store: Store; now: number; analystMode: boolean }) {
  const eg = store.risk.find(r => r.code === 'EG');
  const stats = useMemo(() => {
    const d14 = now - 14 * DAY;
    const d90 = now - 90 * DAY;
    const threads = new Set<Theater>();
    for (const e of store.events) {
      if (Date.parse(e.date) < d14) continue;
      if ((e.involvesSisi || e.relatedEntities.includes('EG')) && ['diplomatic', 'movement', 'inbound'].includes(e.category)) e.theaters.forEach(t => threads.add(t));
    }
    const trips = store.events.filter(e => e.category === 'movement' && e.involvesSisi && e.partner && Date.parse(e.date) >= d90 && !e.upcoming);
    const tripKeys = new Set(trips.map(e => `${e.partner}|${e.date.slice(0, 10)}`));
    const visitsIn = store.partners.reduce((s, p) => s + p.visitsIn, 0);
    const inCountries = store.partners.filter(p => p.visitsIn > 0).length;
    return { threads: [...threads], trips: tripKeys.size, lastTrip: trips[0], visitsIn, inCountries };
  }, [store, now]);

  const partnerOptions = useMemo(() => {
    const ranked = [...store.partners].filter(p => p.lastInboundVisit).sort((a, b) => b.visitsIn - a.visitsIn).map(p => p.code);
    return [...new Set([...ranked, ...WATCH])];
  }, [store.partners]);
  const [partner, setPartner] = useState<string>(() => partnerOptions[0] ?? 'SA');
  const pr = store.partners.find(p => p.code === partner);
  const daysSince = pr?.lastInboundVisit ? daysBetween(now, Date.parse(pr.lastInboundVisit)) : null;

  const corroborated = store.events.filter(e => e.involvesSisi && e.source.tier === 'corroborated').length;
  const sisiTotal = store.events.filter(e => e.involvesSisi).length || 1;

  return (
    <section className={`tiles${analystMode ? " six" : ""}`} aria-label="Headline statistics">
      <div className="tile" style={{ ['--tile-wash' as string]: 'var(--wash-diplomatic)' }}>
        <div className="tile-k">Active diplomatic threads</div>
        <div className="tile-v">{stats.threads.length}</div>
        <div className="tile-sub">{stats.threads.length ? stats.threads.map(t => THEATER_LABEL[t]).join(' · ') : 'No theater engagement in 14 days'}</div>
      </div>
      <div className="tile" style={{ ['--tile-wash' as string]: 'var(--wash-conflict)' }}>
        <div className="tile-k">Egypt risk score</div>
        <div className="tile-v">
          {eg?.score ?? '–'}
          <small>/100</small>
        </div>
        <div className="tile-sub">{eg ? `${eg.level.charAt(0) + eg.level.slice(1).toLowerCase()} · L4 composite` : 'Unavailable'}</div>
      </div>
      <div className="tile" style={{ ['--tile-wash' as string]: 'var(--wash-diplomatic)' }}>
        <div className="tile-k">Foreign trips · 90 days</div>
        <div className="tile-v">{stats.trips}</div>
        <div className="tile-sub">{stats.lastTrip ? `Latest: ${stats.lastTrip.location.name}, ${fmtShort(stats.lastTrip.date)}` : 'No tracked trips'}</div>
      </div>
      <div className="tile" style={{ ['--tile-wash' as string]: 'linear-gradient(135deg, rgba(143,123,255,0.2), rgba(0,170,255,0.06) 60%, transparent)' }}>
        <div className="tile-k">Visits to Egypt · 90 days</div>
        <div className="tile-v">{stats.visitsIn}</div>
        <div className="tile-sub">From {stats.inCountries} {stats.inCountries === 1 ? 'country' : 'countries'}</div>
      </div>
      <div className="tile" style={{ ['--tile-wash' as string]: 'var(--wash-ceremonial)' }}>
        <div className="tile-k">
          Days since last Cairo visit from{' '}
        </div>
        <select aria-label="Partner" value={partner} onChange={e => setPartner(e.target.value)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
          {partnerOptions.map(c => (
            <option key={c} value={c}>{countryName(c)}</option>
          ))}
        </select>
        <div className="tile-v" style={{ marginTop: 4 }}>{daysSince === null ? '90+' : daysSince}</div>
        <div className="tile-sub">{pr?.lastInboundVisit ? `Last visit ${fmtShort(pr.lastInboundVisit)}` : 'No tracked visit in 90 days'}</div>
      </div>
      {analystMode && (
        <div className="tile" style={{ ['--tile-wash' as string]: 'var(--wash-economic)', gridColumn: 'span 1' }}>
          <div className="tile-k">Corroboration rate</div>
          <div className="tile-v">
            {Math.round((corroborated / sisiTotal) * 100)}
            <small>%</small>
          </div>
          <div className="tile-sub">Sisi items with independent coverage</div>
        </div>
      )}
    </section>
  );
}
