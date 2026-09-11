'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Category, OsirisEvent } from '@/lib/osiris/types';
import { CATEGORY, CATEGORY_ORDER, LANES, fmtDate } from '@/lib/osiris/ui';
import ActivityChart from './ActivityChart';

export type RangeKey = '7d' | '30d' | '90d' | 'all';
export const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };
const DAY = 86_400_000;
const LANE_H = 44;
const PAD_L = 110;
const PAD_R = 40;

type Props = {
  events: OsirisEvent[];
  allEvents: OsirisEvent[];
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  cats: Set<Category>;
  onCats: (c: Set<Category>) => void;
  rangeStart: number;
  now: number;
  selectedId: string | null;
  newIds: Set<string>;
  onSelect: (id: string) => void;
};

/** Deterministic vertical jitter so same-day events in a lane don't stack. */
function jitter(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 24;
}

export default function Timeline({ events, allEvents, range, onRange, cats, onCats, rangeStart, now, selectedId, newIds, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<{ e: OsirisEvent; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const end = now + DAY * 0.6;
  const days = Math.max(1, (end - rangeStart) / DAY);
  const minPx = range === '7d' ? 60 : range === '30d' ? 30 : range === '90d' ? 22 : 14;
  const pxPerDay = Math.max(minPx, (width - PAD_L - PAD_R) / days);
  const trackW = Math.max(width, PAD_L + PAD_R + days * pxPerDay);
  const xOf = (t: number) => PAD_L + ((t - rangeStart) / DAY) * pxPerDay;

  const ticks = useMemo(() => {
    const step = pxPerDay >= 70 ? 1 : pxPerDay >= 30 ? 2 : pxPerDay >= 18 ? 7 : 14;
    const out: { x: number; label: string }[] = [];
    const first = new Date(rangeStart);
    first.setUTCHours(0, 0, 0, 0);
    for (let t = first.getTime() + DAY; t <= end; t += step * DAY) {
      out.push({ x: xOf(t), label: new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, end, pxPerDay]);

  const selected = selectedId ? events.find(e => e.id === selectedId) : undefined;

  // Scrub to the selection (or to "now" on first paint / range change).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = selected ? xOf(Date.parse(selected.date)) - el.clientWidth / 2 : trackW;
    el.scrollTo({ left: Math.max(0, target), behavior: selected ? 'smooth' : 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, range, trackW]);

  const scrollToDate = (t: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, xOf(t) - el.clientWidth / 2), behavior: 'smooth' });
  };

  const toggleCat = (c: Category) => {
    const n = new Set(cats);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    onCats(n.size ? n : new Set(CATEGORY_ORDER));
  };
  const counts = useMemo(() => {
    const m: Partial<Record<Category, number>> = {};
    for (const e of allEvents) if (Date.parse(e.date) >= rangeStart) m[e.category] = (m[e.category] ?? 0) + 1;
    return m;
  }, [allEvents, rangeStart]);

  return (
    <section className="section card card-pad" aria-label="Timeline">
      <div className="card-head">
        <div>
          <div className="eyebrow">Synced with the map</div>
          <h2 className="card-title">Timeline</h2>
        </div>
        <div className="seg" role="group" aria-label="Date range">
          {(['7d', '30d', '90d', 'all'] as RangeKey[]).map(r => (
            <button key={r} aria-pressed={range === r} onClick={() => onRange(r)}>
              {r === 'all' ? 'All' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="tl-controls">
        <div className="chips" role="group" aria-label="Categories">
          {CATEGORY_ORDER.map(c => (
            <button key={c} className="chip" aria-pressed={cats.has(c)} onClick={() => toggleCat(c)} style={{ ['--chip-color' as string]: CATEGORY[c].color }}>
              <span className="pill-dot" aria-hidden />
              {CATEGORY[c].short}
              <span className="faint" style={{ fontWeight: 500 }}>{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{events.length} items · use ← → to step through</span>
      </div>

      <div className="tl-chart">
        <ActivityChart events={events} start={rangeStart} end={end} onPick={scrollToDate} />
      </div>

      <div className="tl-outer">
        <div className="tl-scroll" ref={scroller} onScroll={() => setHover(null)}>
          <div className="tl-track" style={{ width: trackW }} onMouseLeave={() => setHover(null)}>
            {LANES.map((l, i) => (
              <div key={l} className="tl-lane" style={{ top: 6 + i * LANE_H }}>
                <span className="tl-lane-label">{l}</span>
              </div>
            ))}
            <div className="tl-today" style={{ left: xOf(now) }} />
            {selected && <div className="tl-cursor" style={{ left: xOf(Date.parse(selected.date)) }} />}
            {events.map(e => {
              const meta = CATEGORY[e.category];
              const x = xOf(Date.parse(e.date));
              const y = 6 + meta.lane * LANE_H + LANE_H / 2 + jitter(e.id) * 0.7;
              const cls = ['tl-dot', newIds.has(e.id) && 'is-new', selectedId === e.id && 'is-selected', selectedId && selectedId !== e.id && 'is-dim'].filter(Boolean).join(' ');
              return (
                <button
                  key={e.id}
                  className={cls}
                  style={{ left: x, top: y, ['--dot' as string]: meta.color, ['--dot-glow' as string]: meta.glow }}
                  aria-label={`${fmtDate(e.date)}: ${e.title}`}
                  onClick={() => onSelect(e.id)}
                  onMouseEnter={() => setHover({ e, x, y })}
                  onFocus={() => setHover({ e, x, y })}
                  onBlur={() => setHover(null)}
                />
              );
            })}
            <div className="tl-axis">
              {ticks.map(t => (
                <span key={t.x} className="tl-tick" style={{ left: t.x }}>{t.label}</span>
              ))}
            </div>
            {hover && (
              <div className="glass tl-tip" style={{ left: Math.min(Math.max(hover.x, 150), trackW - 150), top: hover.y }}>
                <div style={{ fontSize: 11, color: CATEGORY[hover.e.category].color, fontWeight: 700 }}>
                  {CATEGORY[hover.e.category].short} · {fmtDate(hover.e.date)}
                </div>
                <div style={{ marginTop: 2 }}>{hover.e.title}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
