'use client';

import type { Store } from '@/lib/osiris/types';
import { relTime } from '@/lib/osiris/ui';

export default function Header({ store, now, analystMode, onToggleAnalyst }: { store: Store; now: number; analystMode: boolean; onToggleAnalyst: () => void }) {
  const ageMin = (now - Date.parse(store.generatedAt)) / 60_000;
  const stale = ageMin > 90 || store.mode !== 'live';
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <a className="brand" href="https://l4global.com" aria-label="L4 Global home" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="brand-mark" aria-hidden>
            <span>
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2" fill="none" stroke="#00aaff" strokeWidth="2" /><circle cx="8" cy="8" r="1.8" fill="#f0f4ff" /></svg>
            </span>
          </span>
          <span>
            <div className="brand-title">OSIRIS FILE <b>·</b> SISI</div>
            <div className="brand-sub">L4 GLOBAL · LIVING LEADERSHIP PROFILE</div>
          </span>
        </a>
        <span className="live" title={`Store generated ${new Date(store.generatedAt).toUTCString()}`}>
          <span className={`live-dot${stale ? ' stale' : ''}`} aria-hidden />
          {store.mode === 'snapshot' ? 'Offline snapshot' : `Updated ${relTime(store.generatedAt, now)}`}
          <span className="faint">· refreshes every 30 min</span>
        </span>
        <button className="toggle" aria-pressed={analystMode} onClick={onToggleAnalyst} title="Show denser panels: risk breakdowns, sourcing detail, relationship table, source health">
          <span className="toggle-track" aria-hidden />
          Analyst Mode
        </button>
      </div>
    </header>
  );
}
