'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ExternalLink, Link2, MapPin, X } from 'lucide-react';
import type { OsirisEvent } from '@/lib/osiris/types';
import type { CoverageEntry } from '@/config/related-coverage';
import { CATEGORY, THEATER_LABEL, fmtDate, fmtDateTime, hostOf } from '@/lib/osiris/ui';
import { sourcingLabel } from '@/lib/osiris/corroborate';
import { countryName, hasTerm } from '@/lib/osiris/gazetteer';
import { useMediaQuery } from './hooks';
import AnalystReadCard from './AnalystReadCard';

const STATE_AFFILIATED = ['ahram.org.eg', 'akhbarelyom.com', 'egypttoday.com', 'alqaheranews.net', 'extranews.tv', 'sada-elbalad.com'];

type Props = {
  event: OsirisEvent | null;
  byId: Map<string, OsirisEvent>;
  placeIds: string[];
  coverage: CoverageEntry[];
  isNew: boolean;
  analystMode: boolean;
  prev?: OsirisEvent;
  next?: OsirisEvent;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function relatedCoverage(e: OsirisEvent, coverage: CoverageEntry[]) {
  const text = `${e.title} ${e.summary}`;
  return coverage.filter(c => c.match.some(m => (/^[A-Z]{2,3}$/.test(m) ? e.relatedEntities.includes(m) : hasTerm(text, m))));
}

export default function DetailDrawer({ event, byId, placeIds, coverage, isNew, analystMode, prev, next, onSelect, onClose }: Props) {
  const mobile = useMediaQuery('(max-width: 640px)');
  return (
    <AnimatePresence>
      {event && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="drawer"
            className="drawer glass"
            role="dialog"
            aria-modal="true"
            aria-label={event.title}
            initial={mobile ? { y: '100%' } : { x: 520, opacity: 0.4 }}
            animate={mobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={mobile ? { y: '100%' } : { x: 520, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{ ['--drawer-wash' as string]: `var(--wash-${CATEGORY[event.category].family})` }}
          >
            <DrawerContent event={event} byId={byId} placeIds={placeIds} coverage={coverage} isNew={isNew} analystMode={analystMode} prev={prev} next={next} onSelect={onSelect} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerContent({ event: e, byId, placeIds, coverage, isNew, analystMode, prev, next, onSelect, onClose }: Props & { event: OsirisEvent }) {
  const meta = CATEGORY[e.category];
  const tag = sourcingLabel(e);
  const related = useMemo(() => relatedCoverage(e, coverage), [e, coverage]);
  const morePlace = placeIds.filter(id => id !== e.id).map(id => byId.get(id)).filter(Boolean) as OsirisEvent[];
  const linked = (e.linkedEventIds ?? []).map(id => byId.get(id)).filter(Boolean) as OsirisEvent[];

  return (
    <>
      <div className="drawer-wash" aria-hidden />
      <div className="drawer-head">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingRight: 44 }}>
          <span className="pill" style={{ borderColor: meta.color, color: meta.color }}>
            <span className="pill-dot" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
            {meta.short}
          </span>
          <span className="faint" style={{ fontSize: 12.5 }}>{fmtDateTime(e.date)}</span>
          {isNew && <span className="pill tag-new">NEW</span>}
          {e.upcoming && <span className="pill">Announced</span>}
        </div>
        <h3 className="drawer-title">{e.title}</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={14} /> {e.location.name}
          </span>
          <span className={`pill tag-${tag.tone}`} title={TAG_HELP[tag.tone]}>{tag.text}</span>
        </div>
        <div className="drawer-nav">
          <button className="btn" disabled={!prev} onClick={() => prev && onSelect(prev.id)} aria-label="Previous event" style={{ opacity: prev ? 1 : 0.4 }}>
            <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Earlier
          </button>
          <button className="btn" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next event" style={{ opacity: next ? 1 : 0.4 }}>
            Later <ChevronRight size={14} style={{ verticalAlign: -2 }} />
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {e.summary && e.summary !== e.title && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: '#dfe7fb' }}>{e.summary}</p>}

        {(e.partner || e.theaters.length > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {e.partner && <span className="pill"><span className="cc">{e.partner}</span>{countryName(e.partner)}</span>}
            {e.theaters.map(t => <span key={t} className="pill">{THEATER_LABEL[t]}</span>)}
          </div>
        )}

        {e.diplomaticLinkage && (
          <div>
            <div className="block-k"><Link2 size={13} /> Egyptian diplomatic linkage</div>
            <div className={`linkage${e.linkageKind === 'standing' ? ' standing' : ''}`}>
              {e.diplomaticLinkage}
              {linked.length > 0 && (
                <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                  {linked.map(l => (
                    <button key={l.id} className="btn-link" style={{ textAlign: 'left' }} onClick={() => onSelect(l.id)}>
                      {fmtDate(l.date)} · {l.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {e.analystRead && <AnalystReadCard read={e.analystRead} onOpen={onSelect} exists={id => byId.has(id)} />}

        <div>
          <div className="block-k">Sources ({e.sources.length})</div>
          <ul className="sources">
            {e.sources.map(s => {
              const affiliated = STATE_AFFILIATED.some(d => hostOf(s.url).endsWith(d));
              return (
                <li key={s.url}>
                  <span className={`pill ${s.kind === 'state' ? 'tag-state' : 'tag-corroborated'}`} style={{ fontSize: 10.5 }}>{s.kind === 'state' ? 'State' : 'Independent'}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.name} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
                  </a>
                  {analystMode && (
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      via {s.feed}{s.publishedAt ? ` · ${fmtDate(s.publishedAt)}` : ''}{affiliated ? ' · state-owned outlet' : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {analystMode && <p className="faint" style={{ fontSize: 11.5, margin: '10px 0 0' }}>{TAG_HELP[tag.tone]}</p>}
        </div>

        {related.length > 0 && (
          <div className="related">
            <div className="block-k">Related L4 coverage</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {related.map(r => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                  <span className="faint" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{r.category} · {fmtDate(r.date)}</span>
                  <div>{r.title}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {morePlace.length > 0 && (
          <div>
            <div className="block-k">More at {e.location.name} ({morePlace.length})</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {morePlace.slice(0, 8).map(m => (
                <button key={m.id} className="btn-link" style={{ textAlign: 'left', color: 'var(--text-2)' }} onClick={() => onSelect(m.id)}>
                  <span style={{ color: CATEGORY[m.category].color }}>●</span> {fmtDate(m.date)} · {m.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <LocationContext lat={e.location.lat} lng={e.location.lng} name={e.location.name} key={e.id} />
      </div>
    </>
  );
}

const TAG_HELP = {
  state: 'Only Egyptian state outlets (Presidency, SIS, MENA) carried this. Treat as the official account until independent coverage appears.',
  corroborated: 'Carried by at least one outlet outside the Egyptian state press (or by two or more independent outlets).',
  single: 'Reported by one independent outlet, with no official Egyptian account matched.',
} as const;

function LocationContext({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ wikipedia?: { title: string; extract: string } | null; head_of_state?: { name: string; position: string } | null; location?: { country?: string } } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!open || data) return;
    fetch(`/api/region-dossier?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setErr(true));
  }, [open, data, lat, lng]);
  return (
    <div>
      <button className="btn-link" onClick={() => setOpen(v => !v)}>{open ? 'Hide' : 'About this location'}: {name}</button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}>
          {!data && !err && 'Loading…'}
          {err && 'Location context unavailable.'}
          {data?.wikipedia?.extract && <p style={{ margin: '0 0 6px' }}>{data.wikipedia.extract}</p>}
          {data?.head_of_state && <p className="faint" style={{ margin: 0 }}>{data.location?.country}: {data.head_of_state.position}, {data.head_of_state.name} (Wikidata)</p>}
        </div>
      )}
    </div>
  );
}
