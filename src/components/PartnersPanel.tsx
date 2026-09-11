'use client';

import { useState } from 'react';
import type { PartnerRank } from '@/lib/osiris/types';
import { fmtShort } from '@/lib/osiris/ui';

export default function PartnersPanel({ partners, analystMode }: { partners: PartnerRank[]; analystMode: boolean }) {
  const [all, setAll] = useState(false);
  const ranked = partners.filter(p => p.total > 0);
  const shown = all || analystMode ? ranked.slice(0, 15) : ranked.slice(0, 6);
  const max = Math.max(1, ...ranked.map(p => p.total));
  return (
    <section className="card card-pad" aria-label="Most engaged partners">
      <div className="card-head">
        <div>
          <div className="eyebrow">Relationship strength</div>
          <h2 className="card-title">Most engaged partners, last 90 days</h2>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>
          <span style={{ color: '#00aaff' }}>■</span> Sisi visited &nbsp;<span style={{ color: '#8f7bff' }}>■</span> visited Cairo
        </span>
      </div>
      {ranked.length === 0 && <p className="muted">No tracked visits in either direction in the last 90 days.</p>}
      <div className="rank">
        {shown.map((p, i) => (
          <div className="rank-row" key={p.code}>
            <span className="rank-n">{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div className="rank-name">
                <span className="cc">{p.code}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </div>
              <div className="rank-bar" style={{ width: `${(p.total / max) * 100}%` }}>
                <span style={{ width: `${(p.visitsOut / p.total) * 100}%`, background: '#00aaff' }} />
                <span style={{ width: `${(p.visitsIn / p.total) * 100}%`, background: '#8f7bff' }} />
              </div>
              {analystMode && (
                <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
                  {p.visitsOut} out · {p.visitsIn} in · {p.contacts} calls/other contacts · last contact {fmtShort(p.lastContact)}
                </div>
              )}
            </div>
            <span className="rank-count">{p.total}</span>
          </div>
        ))}
      </div>
      {!analystMode && ranked.length > 6 && (
        <button className="btn-link" style={{ marginTop: 12 }} onClick={() => setAll(v => !v)}>{all ? 'Show top 6' : `Show all ${Math.min(15, ranked.length)}`}</button>
      )}
      <p className="faint" style={{ fontSize: 11.5, margin: '12px 0 0' }}>Counts in-person visits in either direction, one per partner per day. Calls and meetings on the sidelines of third-country summits are excluded from the ranking{analystMode ? ' and listed separately above' : ''}.</p>
    </section>
  );
}
