'use client';

import { useMemo } from 'react';
import type { OsirisEvent, Theater } from '@/lib/osiris/types';
import { THEATER_DEFS } from '@/lib/osiris/geometry';
import { fmtShort } from '@/lib/osiris/ui';

const DAY = 86_400_000;
const EXTRA: { id: Theater; label: string; egyptLink: string }[] = [
  { id: 'red-sea', label: 'Red Sea / Suez', egyptLink: 'Canal revenue, Houthi attacks and the Damietta strike make shipping security an economic file first.' },
];

export default function TheatersPanel({ events, now, onSelect }: { events: OsirisEvent[]; now: number; onSelect: (id: string) => void }) {
  const rows = useMemo(() => {
    const since = now - 14 * DAY;
    return [...THEATER_DEFS, ...EXTRA].map(t => {
      const items = events.filter(e => e.theaters.includes(t.id) && Date.parse(e.date) >= since);
      const conflict = items.filter(e => e.category === 'conflict' || e.category === 'maritime');
      const diplo = items.filter(e => ['diplomatic', 'movement', 'inbound'].includes(e.category) && (e.involvesSisi || e.relatedEntities.includes('EG')));
      return { t, conflict, diplo, latest: diplo[0] ?? conflict[0] };
    });
  }, [events, now]);
  return (
    <section className="card card-pad" aria-label="Regional theaters">
      <div className="card-head">
        <div>
          <div className="eyebrow">Last 14 days</div>
          <h2 className="card-title">Regional files and Egypt’s role</h2>
        </div>
      </div>
      <div className="theaters">
        {rows.map(({ t, conflict, diplo, latest }) => (
          <div key={t.id} className={`theater${t.id === 'red-sea' ? ' maritime' : ''}`}>
            <h4>{t.label}</h4>
            <p>{t.egyptLink}</p>
            <div className="nums">
              <span><b>{conflict.length}</b>{t.id === 'red-sea' ? 'shipping items' : 'conflict items'}</span>
              <span><b>{diplo.length}</b>Egyptian engagements</span>
            </div>
            {latest && (
              <button className="btn-link" style={{ marginTop: 10, textAlign: 'left', fontSize: 12.5 }} onClick={() => onSelect(latest.id)}>
                {fmtShort(latest.date)} · {latest.title.length > 90 ? latest.title.slice(0, 88) + '…' : latest.title}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
