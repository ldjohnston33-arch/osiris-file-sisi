'use client';

import { useState } from 'react';
import type { AnalystRead } from '@/lib/osiris/types';
import { fmtDate } from '@/lib/osiris/ui';

/**
 * Always labeled as analysis, third person, with its basis one click away.
 * Never rendered in quotation marks or as the president's words.
 */
export default function AnalystReadCard({ read, onOpen, exists }: { read: AnalystRead; onOpen: (id: string) => void; exists: (id: string) => boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="analyst">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="analyst-label">Analyst Read: How this likely fits his pattern</span>
        <span className={`pill ${read.method === 'gemini' ? 'tag-ai' : ''}`} style={{ fontSize: 10.5 }}>{read.method === 'gemini' ? 'AI-assisted' : 'Pattern rules'}</span>
      </div>
      <p className="analyst-posture">{read.posture}</p>
      <button className="btn-link" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {open ? 'Hide the basis' : `Show the basis (${read.basis.length + (read.comparable ? 1 : 0)} records)`}
      </button>
      {open && (
        <ul className="basis">
          {read.basis.map(b => (
            <li key={b.id}>
              <time dateTime={b.date}>{fmtDate(b.date)}</time>
              {b.label}.{' '}
              <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">{b.sourceName}</a>
            </li>
          ))}
          {read.comparable && (
            <li>
              <span className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Comparable prior event</span>
              <div style={{ marginTop: 3 }}>
                <time dateTime={read.comparable.date}>{fmtDate(read.comparable.date)}</time>
                {exists(read.comparable.id) ? (
                  <button className="btn-link" style={{ textAlign: 'left', fontWeight: 500 }} onClick={() => onOpen(read.comparable!.id)}>{read.comparable.title}</button>
                ) : (
                  read.comparable.title
                )}
              </div>
            </li>
          )}
        </ul>
      )}
      <div className="analyst-note">Analytical inference by L4 Global from the cited public record. It is not a statement by, or attributed to, President el-Sisi.</div>
    </div>
  );
}
