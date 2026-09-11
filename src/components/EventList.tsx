'use client';

import { useState } from 'react';
import type { OsirisEvent } from '@/lib/osiris/types';
import { CATEGORY, fmtDate } from '@/lib/osiris/ui';
import { sourcingLabel } from '@/lib/osiris/corroborate';

export default function EventList({ events, selectedId, newIds, onSelect, analystMode }: { events: OsirisEvent[]; selectedId: string | null; newIds: Set<string>; onSelect: (id: string) => void; analystMode: boolean }) {
  const [n, setN] = useState(8);
  const list = events.slice(0, n);
  return (
    <section className="section card card-pad" aria-label="Latest activity">
      <div className="card-head">
        <div>
          <div className="eyebrow">Filtered by the timeline</div>
          <h2 className="card-title">Latest activity</h2>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{events.length} items in view</span>
      </div>
      <div className="feed">
        {list.map(e => {
          const meta = CATEGORY[e.category];
          const tag = sourcingLabel(e);
          return (
            <button key={e.id} className={`ev${selectedId === e.id ? ' is-selected' : ''}`} style={{ ['--ev-color' as string]: meta.color }} onClick={() => onSelect(e.id)}>
              <span className="ev-bar" aria-hidden />
              <span style={{ minWidth: 0 }}>
                <div className="ev-title">{e.title}</div>
                <div className="ev-meta">
                  <span style={{ color: meta.color, fontWeight: 700 }}>{meta.short}</span>
                  <span>{fmtDate(e.date)}</span>
                  <span>{e.location.name}</span>
                  <span className={`pill tag-${tag.tone}`}>{tag.text}</span>
                  {newIds.has(e.id) && <span className="pill tag-new">NEW</span>}
                  {e.analystRead && <span className="pill tag-ai">Analyst Read</span>}
                  {analystMode && <span>{e.sources.length} source{e.sources.length === 1 ? '' : 's'}</span>}
                </div>
              </span>
            </button>
          );
        })}
      </div>
      {events.length > n && (
        <button className="btn" style={{ marginTop: 14 }} onClick={() => setN(v => v + 12)}>Show more</button>
      )}
    </section>
  );
}
