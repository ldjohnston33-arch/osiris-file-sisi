'use client';

import type { Store } from '@/lib/osiris/types';
import { fmtDate, fmtDateTime, relTime } from '@/lib/osiris/ui';

export default function DossierHero({ store, now, onSelect }: { store: Store; now: number; onSelect: (id: string) => void }) {
  const { lastAppearance, lastStatement, nextEngagement } = store.status;
  const b = store.briefing;
  return (
    <section className="hero" aria-label="Dossier summary">
      <div>
        <div className="eyebrow">Osiris File 001 · Arab Republic of Egypt</div>
        <h1 className="hero-name">Abdel Fattah el-Sisi</h1>
        <p className="hero-role">President of Egypt since 2014. Public activity, diplomatic movements and the regional files around Cairo, tracked from open sources.</p>
        <div className="status">
          <StatusRow k="Last confirmed appearance" item={lastAppearance && { ...lastAppearance, meta: `${lastAppearance.place} · ${fmtDate(lastAppearance.date)} · ${relTime(lastAppearance.date, now)}` }} empty="No appearance in the tracked window" onSelect={onSelect} />
          <StatusRow k="Most recent statement" item={lastStatement && { ...lastStatement, meta: `${fmtDate(lastStatement.date)} · ${relTime(lastStatement.date, now)}` }} empty="No statement in the tracked window" onSelect={onSelect} />
          <StatusRow k="Next known engagement" item={nextEngagement && { ...nextEngagement, meta: `Announced ${fmtDate(nextEngagement.date)}` }} empty="None publicly announced" onSelect={onSelect} />
        </div>
      </div>

      <div className="glass briefing">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>The L4 Briefing</span>
          <span className={`pill ${b.method === 'gemini' ? 'tag-ai' : ''}`}>{b.method === 'gemini' ? 'AI-assisted' : 'Rules-based'}</span>
        </div>
        <p className="briefing-text">{b.text}</p>
        <div className="briefing-foot">
          <span>Generated {fmtDateTime(b.generatedAt)}</span>
          <span>·</span>
          <span>Summarises tracked events only; open any item below for its sources.</span>
        </div>
      </div>
    </section>
  );
}

function StatusRow({ k, item, empty, onSelect }: { k: string; item?: { id: string; title: string; meta: string }; empty: string; onSelect: (id: string) => void }) {
  return (
    <button className="status-row" disabled={!item} onClick={() => item && onSelect(item.id)}>
      <span className="status-k">{k}</span>
      <span>
        <div className="status-v">{item ? item.title : <span className="muted">{empty}</span>}</div>
        {item && <div className="status-meta">{item.meta}</div>}
      </span>
    </button>
  );
}
