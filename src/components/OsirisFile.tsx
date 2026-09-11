'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Category, OsirisEvent, Store } from '@/lib/osiris/types';
import type { CoverageEntry } from '@/config/related-coverage';
import { CATEGORY_ORDER, layerFor, type LayerId } from '@/lib/osiris/ui';
import { readLocal, useNow, writeLocal } from './hooks';
import Header from './Header';
import DossierHero from './DossierHero';
import StatTiles from './StatTiles';
import Timeline, { type RangeKey, RANGE_DAYS } from './Timeline';
import DetailDrawer from './DetailDrawer';
import PartnersPanel from './PartnersPanel';
import TheatersPanel from './TheatersPanel';
import EventList from './EventList';
import AnalystPanels from './AnalystPanels';
import LayerToggles from './LayerToggles';
import Footer from './Footer';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="map-fallback">Loading map…</div>,
});

const LS_LAST_SEEN = 'osiris-file:sisi:lastSeen';
const LS_ANALYST = 'osiris-file:analystMode';
const POLL_MS = 15 * 60_000;
const DAY = 86_400_000;

export default function OsirisFile({ initial, coverage }: { initial: Store; coverage: CoverageEntry[] }) {
  const [store, setStore] = useState<Store>(initial);
  const now = useNow(initial.generatedAt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Set<LayerId>>(() => new Set<LayerId>(['movements']));
  const [cats, setCats] = useState<Set<Category>>(() => new Set(CATEGORY_ORDER));
  const [range, setRange] = useState<RangeKey>('30d');
  const [analystMode, setAnalystMode] = useState(false);
  const [prevSeen, setPrevSeen] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);

  // ── persisted per-viewer preferences ──────────────────────────────
  useEffect(() => {
    setAnalystMode(readLocal(LS_ANALYST) === '1');
    setPrevSeen(readLocal(LS_LAST_SEEN));
  }, []);
  useEffect(() => {
    // Mark as seen when the visitor leaves, so badges survive this visit.
    const mark = () => writeLocal(LS_LAST_SEEN, new Date().toISOString());
    const onHide = () => document.visibilityState === 'hidden' && mark();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', mark);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', mark);
    };
  }, []);
  const toggleAnalyst = () => {
    setAnalystMode(v => {
      writeLocal(LS_ANALYST, v ? '0' : '1');
      return !v;
    });
  };

  // ── keep long-open tabs current (store refreshes every ~30 min) ───
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/events?since=${encodeURIComponent(store.generatedAt)}`);
        const json = await res.json();
        if (!json.unchanged && json.events) setStore(json as Store);
      } catch { /* keep current */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [store.generatedAt]);

  const events = store.events;
  const byId = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const newIds = useMemo(() => {
    if (!prevSeen) return new Set<string>();
    return new Set(events.filter(e => e.firstSeen > prevSeen && Date.parse(e.date) > Date.parse(prevSeen) - 7 * DAY).map(e => e.id));
  }, [events, prevSeen]);

  const rangeStart = range === 'all' ? Math.min(...events.map(e => Date.parse(e.date)), now - 90 * DAY) : now - RANGE_DAYS[range] * DAY;
  const filtered = useMemo(
    () => events.filter(e => cats.has(e.category) && Date.parse(e.date) >= rangeStart && (!onlyNew || newIds.has(e.id))),
    [events, cats, rangeStart, onlyNew, newIds],
  );
  const mapEvents = useMemo(() => filtered.filter(e => layerFor(e)), [filtered]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // ── one selection, three views ────────────────────────────────────
  const select = useCallback(
    (id: string | null, opts: { from?: 'map' | 'timeline' | 'list' | 'status'; placeIds?: string[] } = {}) => {
      setSelectedId(id);
      setPlaceIds(opts.placeIds ?? []);
      if (!id) return;
      const e = byId.get(id);
      if (!e) return;
      // Widen the timeline if the event sits outside the current range/filter.
      if (Date.parse(e.date) < rangeStart) setRange('all');
      if (!cats.has(e.category)) setCats(prev => new Set([...prev, e.category]));
      if (onlyNew && !newIds.has(id)) setOnlyNew(false);
      // Timeline/list clicks bring the map into view on small screens.
      if (opts.from !== 'map' && opts.from !== 'timeline' && window.innerWidth < 900) {
        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [byId, rangeStart, cats, onlyNew, newIds],
  );

  // Keyboard: Esc closes, arrows walk the filtered timeline.
  const ordered = useMemo(() => [...filtered].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)), [filtered]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
      if (ev.key === 'Escape') setSelectedId(null);
      if (!selectedId || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
      const i = ordered.findIndex(e => e.id === selectedId);
      const next = ordered[i + (ev.key === 'ArrowRight' ? 1 : -1)];
      if (next) {
        ev.preventDefault();
        select(next.id, { from: 'timeline' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ordered, selectedId, select]);

  const neighbours = useMemo(() => {
    if (!selected) return { prev: undefined as OsirisEvent | undefined, next: undefined as OsirisEvent | undefined };
    const i = ordered.findIndex(e => e.id === selected.id);
    return { prev: i > 0 ? ordered[i - 1] : undefined, next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : undefined };
  }, [ordered, selected]);

  const toggleLayer = (id: LayerId) =>
    setLayers(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <Header store={store} now={now} analystMode={analystMode} onToggleAnalyst={toggleAnalyst} />
      <main className="wrap">
        <DossierHero store={store} now={now} onSelect={id => select(id, { from: 'status' })} />
        <StatTiles store={store} now={now} analystMode={analystMode} />

        {newIds.size > 0 && (
          <div className="newbar" role="status">
            <span className="pill tag-new">NEW</span>
            <span>
              <b>{newIds.size}</b> item{newIds.size === 1 ? '' : 's'} added since your last visit.
            </span>
            <button className="btn-link" onClick={() => setOnlyNew(v => !v)}>
              {onlyNew ? 'Show everything' : 'Show only what’s new'}
            </button>
          </div>
        )}

        <section className="section card map-card" ref={mapRef} aria-label="Map">
          <div className="card-pad" style={{ paddingBottom: 14 }}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <div>
                <div className="eyebrow">Drill-in layer</div>
                <h2 className="card-title">Movements and regional context</h2>
              </div>
              <span className="faint" style={{ fontSize: 12.5 }}>Click any marker to open it on the timeline.</span>
            </div>
            <LayerToggles layers={layers} onToggle={toggleLayer} />
          </div>
          <div className="map-shell">
            <MapView
              events={mapEvents}
              layers={layers}
              selected={selected}
              maritime={store.maritime.features}
              onSelect={(id, ids) => select(id, { from: 'map', placeIds: ids })}
            />
          </div>
        </section>

        <Timeline
          events={filtered}
          allEvents={events}
          range={range}
          onRange={setRange}
          cats={cats}
          onCats={setCats}
          rangeStart={rangeStart}
          now={now}
          selectedId={selectedId}
          newIds={newIds}
          onSelect={id => select(id, { from: 'timeline' })}
        />

        <div className="section grid-2">
          <PartnersPanel partners={store.partners} analystMode={analystMode} />
          <TheatersPanel events={events} now={now} onSelect={id => select(id, { from: 'list' })} />
        </div>

        <EventList events={filtered} selectedId={selectedId} newIds={newIds} onSelect={id => select(id, { from: 'list' })} analystMode={analystMode} />

        {analystMode && <AnalystPanels store={store} />}
      </main>
      <Footer store={store} />

      <DetailDrawer
        event={selected}
        byId={byId}
        placeIds={placeIds}
        coverage={coverage}
        isNew={selected ? newIds.has(selected.id) : false}
        analystMode={analystMode}
        prev={neighbours.prev}
        next={neighbours.next}
        onSelect={id => select(id, { from: 'list' })}
        onClose={() => select(null)}
      />
    </>
  );
}
