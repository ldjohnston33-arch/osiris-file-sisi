'use client';

/**
 * MapLibre view over the event store.
 *
 * Events are aggregated per (layer, place) so a pile of visits at Ittihadiya
 * reads as one marker with a count; clicking it selects the most recent and
 * hands the rest to the drawer. Theater geometry and the Red Sea layer are
 * static GeoJSON. The selected event always gets a focus marker, even when
 * its layer is toggled off, so a timeline click never lands on empty map.
 */

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { MaritimeFeature, OsirisEvent } from '@/lib/osiris/types';
import type { Feature, FeatureCollection } from 'geojson';
import { CATEGORY, layerFor, type LayerId } from '@/lib/osiris/ui';
import { THEATER_DEFS, SHIPPING_LANE, circle, arc } from '@/lib/osiris/geometry';

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE || 'https://tiles.openfreemap.org/styles/dark';

// Minimal offline style: brand background only, used if the basemap fails.
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#080c14' } }],
};

type Props = {
  events: OsirisEvent[];
  layers: Set<LayerId>;
  selected: OsirisEvent | null;
  maritime: MaritimeFeature[];
  onSelect: (id: string, placeIds: string[]) => void;
};

const LAYER_GROUPS: Record<LayerId, string[]> = {
  movements: ['arcs-movements'],
  inbound: ['arcs-inbound'],
  conflict: ['theater-halo', 'theater-outline', 'theater-lines', 'theater-lines-glow', 'theater-sites'],
  maritime: ['lane', 'lane-glow', 'vessels-heat', 'maritime-points'],
};

function brandBasemap(map: maplibregl.Map) {
  // Recolour whatever vector basemap loaded toward the L4 palette.
  for (const layer of map.getStyle().layers ?? []) {
    try {
      const id = layer.id.toLowerCase();
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#080c14');
      else if (layer.type === 'fill' && /water|ocean|sea/.test(id)) map.setPaintProperty(layer.id, 'fill-color', '#0b1628');
      else if (layer.type === 'fill' && /land|park|wood|grass|landcover|landuse/.test(id)) map.setPaintProperty(layer.id, 'fill-opacity', 0.25);
      else if (layer.type === 'line' && /boundary|admin/.test(id)) {
        map.setPaintProperty(layer.id, 'line-color', '#3a4a6a');
      } else if (layer.type === 'line' && /road|highway|transport|rail|path|street|bridge|tunnel/.test(id)) {
        map.setPaintProperty(layer.id, 'line-opacity', 0.25);
      } else if (layer.type === 'symbol') {
        if (/poi|housenumber|road|highway|transport|shield/.test(id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
        else {
          map.setPaintProperty(layer.id, 'text-color', /country/.test(id) ? '#9aaac0' : '#7a8baa');
          map.setPaintProperty(layer.id, 'text-halo-color', '#080c14');
        }
      }
    } catch { /* property not applicable to this layer */ }
  }
}

function eventGeo(events: OsirisEvent[]) {
  // Aggregate per layer + rounded place.
  const groups = new Map<string, OsirisEvent[]>();
  for (const e of events) {
    const layer = layerFor(e);
    if (!layer) continue;
    const key = `${layer}|${e.location.lat.toFixed(2)},${e.location.lng.toFixed(2)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const points: Feature[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const lead = list[0];
    const layer = key.split('|')[0];
    points.push({
      type: 'Feature',
      properties: {
        key, layer, count: list.length, leadId: lead.id, ids: JSON.stringify(list.map(e => e.id)),
        color: CATEGORY[lead.category].color, title: lead.title, place: lead.location.name,
      },
      geometry: { type: 'Point', coordinates: [lead.location.lng, lead.location.lat] },
    });
  }
  const arcs: Feature[] = [];
  const seenArc = new Set<string>();
  for (const e of events) {
    const layer = layerFor(e);
    if (!e.origin || (layer !== 'movements' && layer !== 'inbound')) continue;
    const from: [number, number] = [e.origin.lng, e.origin.lat];
    const to: [number, number] = [e.location.lng, e.location.lat];
    if (Math.hypot(from[0] - to[0], from[1] - to[1]) < 0.4) continue;
    const k = `${layer}|${from.join()}|${to.join()}`;
    if (seenArc.has(k)) continue;
    seenArc.add(k);
    arcs.push({ type: 'Feature', properties: { layer, color: CATEGORY[e.category].color }, geometry: { type: 'LineString', coordinates: arc(from, to) } });
  }
  return { points: { type: 'FeatureCollection', features: points } as FeatureCollection, arcs: { type: 'FeatureCollection', features: arcs } as FeatureCollection };
}

function theaterGeo(): FeatureCollection {
  const features: Feature[] = [];
  for (const t of THEATER_DEFS) {
    const ring = t.outline ?? (t.radiusKm ? circle(t.center, t.radiusKm) : null);
    if (ring) features.push({ type: 'Feature', properties: { kind: t.outline ? 'outline' : 'halo', label: t.label, note: t.outline ? `${t.label} (approximate outline)` : `${t.label}: indicative theater area, not a control map` }, geometry: { type: 'Polygon', coordinates: [ring] } });
    for (const l of t.lines) features.push({ type: 'Feature', properties: { kind: 'line', label: l.label, note: l.note }, geometry: { type: 'LineString', coordinates: l.coords } });
    for (const s of t.sites) features.push({ type: 'Feature', properties: { kind: 'site', label: s.name, note: `${s.note} ${t.egyptLink ? '' : ''}`.trim() }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } });
  }
  return { type: 'FeatureCollection', features };
}

function maritimeGeo(features: MaritimeFeature[]) {
  const pts = features.filter(f => f.kind !== 'vessel').map<Feature>(f => ({ type: 'Feature', properties: { kind: f.kind, label: f.name, note: f.note ?? '' }, geometry: { type: 'Point', coordinates: [f.lng, f.lat] } }));
  const vessels = features.filter(f => f.kind === 'vessel').map<Feature>(f => ({ type: 'Feature', properties: { n: Number(f.note) || 1 }, geometry: { type: 'Point', coordinates: [f.lng, f.lat] } }));
  return {
    points: { type: 'FeatureCollection', features: pts } as FeatureCollection,
    vessels: { type: 'FeatureCollection', features: vessels } as FeatureCollection,
    lane: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: SHIPPING_LANE } } as Feature,
  };
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapView({ events, layers, selected, maritime, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Increments every time our sources/layers are (re)installed on a style.
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // ── init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!box.current || mapRef.current) return;
    try {
      maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    } catch { /* older API */ }
    const small = window.innerWidth < 640;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: box.current,
        style: STYLE_URL,
        center: small ? [34, 23] : [33, 25.5],
        zoom: small ? 2.4 : 3.35,
        minZoom: 1.5,
        maxZoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: small,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Map failed to start';
      queueMicrotask(() => setFailed(msg));
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    let styleFailed = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) {
        styleFailed = true;
        map.setStyle(FALLBACK_STYLE);
      }
    }, 9000);
    map.on('error', ev => {
      if (!styleFailed && !map.isStyleLoaded() && /style|fetch|Failed/i.test(String(ev.error?.message))) {
        styleFailed = true;
        map.setStyle(FALLBACK_STYLE);
      }
    });

    const setup = () => {
      window.clearTimeout(fallbackTimer);
      if (map.getSource('events')) return;
      brandBasemap(map);
      const hasGlyphs = !!map.getStyle().glyphs;
      const t = theaterGeo();
      const m = maritimeGeo([]);
      map.addSource('theaters', { type: 'geojson', data: t });
      map.addSource('lane', { type: 'geojson', data: m.lane, lineMetrics: true });
      map.addSource('maritime', { type: 'geojson', data: empty });
      map.addSource('vessels', { type: 'geojson', data: empty });
      map.addSource('arcs', { type: 'geojson', data: empty, lineMetrics: true });
      map.addSource('events', { type: 'geojson', data: empty });
      map.addSource('focus', { type: 'geojson', data: empty });

      // Conflict geometry
      map.addLayer({ id: 'theater-halo', type: 'fill', source: 'theaters', filter: ['in', ['get', 'kind'], ['literal', ['halo', 'outline']]], paint: { 'fill-color': '#ff4d5e', 'fill-opacity': ['match', ['get', 'kind'], 'outline', 0.22, 0.06] } });
      map.addLayer({ id: 'theater-outline', type: 'line', source: 'theaters', filter: ['in', ['get', 'kind'], ['literal', ['halo', 'outline']]], paint: { 'line-color': '#ff4d5e', 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'theater-lines-glow', type: 'line', source: 'theaters', filter: ['==', ['get', 'kind'], 'line'], paint: { 'line-color': '#ff6b3d', 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 4 } });
      map.addLayer({ id: 'theater-lines', type: 'line', source: 'theaters', filter: ['==', ['get', 'kind'], 'line'], paint: { 'line-color': '#ff8a3d', 'line-width': 2.4, 'line-dasharray': [3, 1.6] } });
      map.addLayer({ id: 'theater-sites', type: 'circle', source: 'theaters', filter: ['==', ['get', 'kind'], 'site'], paint: { 'circle-radius': 4.5, 'circle-color': '#080c14', 'circle-stroke-color': '#ff8a3d', 'circle-stroke-width': 1.6 } });

      // Red Sea / Suez
      map.addLayer({ id: 'lane-glow', type: 'line', source: 'lane', paint: { 'line-color': '#19d3c5', 'line-width': 7, 'line-opacity': 0.18, 'line-blur': 4 } });
      map.addLayer({ id: 'lane', type: 'line', source: 'lane', paint: { 'line-color': '#19d3c5', 'line-width': 1.6, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
      map.addLayer({ id: 'vessels-heat', type: 'heatmap', source: 'vessels', paint: { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 1, 0.3, 20, 1], 'heatmap-radius': 26, 'heatmap-opacity': 0.75, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(25,211,197,0)', 0.4, 'rgba(25,211,197,0.45)', 1, 'rgba(160,255,245,0.9)'] } });
      map.addLayer({ id: 'maritime-points', type: 'circle', source: 'maritime', paint: { 'circle-radius': ['match', ['get', 'kind'], 'chokepoint', 7, 3.5], 'circle-color': ['match', ['get', 'kind'], 'chokepoint', 'rgba(25,211,197,0.25)', '#19d3c5'], 'circle-stroke-color': '#19d3c5', 'circle-stroke-width': ['match', ['get', 'kind'], 'chokepoint', 2, 0] } });

      // Movement arcs
      for (const [id, color] of [['arcs-movements', '#00aaff'], ['arcs-inbound', '#8f7bff']] as const) {
        map.addLayer({
          id, type: 'line', source: 'arcs', filter: ['==', ['get', 'layer'], id === 'arcs-movements' ? 'movements' : 'inbound'],
          paint: { 'line-width': 1.8, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(255,255,255,0)', 0.5, color, 1, color], 'line-opacity': 0.8 },
          layout: { 'line-cap': 'round' },
        });
      }

      // Event markers: glow + core (+ count)
      map.addLayer({ id: 'events-glow', type: 'circle', source: 'events', paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 13, 20, 26], 'circle-blur': 1, 'circle-opacity': 0.55 } });
      map.addLayer({ id: 'events-core', type: 'circle', source: 'events', paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 5.5, 20, 12], 'circle-stroke-color': '#f0f4ff', 'circle-stroke-width': 1.4 } });
      if (hasGlyphs) {
        map.addLayer({ id: 'events-count', type: 'symbol', source: 'events', filter: ['>', ['get', 'count'], 1], layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 10.5, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#04121f' } });
      }
      map.addLayer({ id: 'focus-ring', type: 'circle', source: 'focus', paint: { 'circle-radius': 20, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.9 } });
      map.addLayer({ id: 'focus-core', type: 'circle', source: 'focus', paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });

      // Interactions
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '280px' });
      const hoverable = ['events-core', 'theater-sites', 'theater-lines', 'maritime-points'];
      for (const id of hoverable) {
        map.on('mouseenter', id, e => {
          map.getCanvas().style.cursor = 'pointer';
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, string>;
          const html = id === 'events-core'
            ? `<b>${esc(p.place)}</b><br/>${esc(p.title)}${Number(p.count) > 1 ? `<br/><span style="color:#9aaac0">+${Number(p.count) - 1} more here</span>` : ''}`
            : `<b>${esc(p.label)}</b><br/><span style="color:#9aaac0">${esc(p.note)}</span>`;
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = '';
          popup.remove();
        });
      }
      map.on('click', 'events-core', e => {
        const p = e.features?.[0]?.properties as Record<string, string> | undefined;
        if (!p) return;
        popup.remove();
        onSelectRef.current(p.leadId, JSON.parse(p.ids));
      });
      setReady(g => g + 1);
    };
    map.on('style.load', setup);
    map.on('load', setup);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      window.clearTimeout(fallbackTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { points, arcs } = eventGeo(events);
    (map.getSource('events') as maplibregl.GeoJSONSource | undefined)?.setData(points);
    (map.getSource('arcs') as maplibregl.GeoJSONSource | undefined)?.setData(arcs);
  }, [events, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const m = maritimeGeo(maritime);
    (map.getSource('maritime') as maplibregl.GeoJSONSource | undefined)?.setData(m.points);
    (map.getSource('vessels') as maplibregl.GeoJSONSource | undefined)?.setData(m.vessels);
  }, [maritime, ready]);

  // ── layer visibility ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [layer, ids] of Object.entries(LAYER_GROUPS) as [LayerId, string[]][]) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers.has(layer) ? 'visible' : 'none');
    }
    const active = ['literal', [...layers]];
    for (const id of ['events-glow', 'events-core', 'events-count']) {
      if (map.getLayer(id)) map.setFilter(id, (id === 'events-count' ? ['all', ['>', ['get', 'count'], 1], ['in', ['get', 'layer'], active]] : ['in', ['get', 'layer'], active]) as unknown as maplibregl.FilterSpecification);
    }
  }, [layers, ready]);

  // ── selection → focus + fly ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('focus') as maplibregl.GeoJSONSource | undefined;
    if (!selected) {
      src?.setData(empty);
      return;
    }
    src?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { color: CATEGORY[selected.category].color }, geometry: { type: 'Point', coordinates: [selected.location.lng, selected.location.lat] } }] });
    const small = window.innerWidth < 640;
    // Keep the point clear of the drawer on desktop.
    const padding = small ? { top: 40, bottom: Math.round(window.innerHeight * 0.3), left: 20, right: 20 } : { top: 40, bottom: 40, left: 40, right: Math.min(480, window.innerWidth * 0.36) };
    const zoom = Math.max(map.getZoom(), selected.category === 'conflict' || selected.location.name === 'Cairo' ? 4.6 : 3.8);
    map.flyTo({ center: [selected.location.lng, selected.location.lat], zoom: Math.min(zoom, 6.5), padding, duration: 1100, essential: true });
  }, [selected, ready]);

  // Pulse the focus ring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selected) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = ((t - t0) % 1600) / 1600;
      if (map.getLayer('focus-ring')) {
        map.setPaintProperty('focus-ring', 'circle-radius', 10 + k * 22);
        map.setPaintProperty('focus-ring', 'circle-stroke-opacity', 0.9 * (1 - k));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected, ready]);

  return (
    <>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {failed && <div className="map-fallback">Map unavailable in this browser ({failed}). The timeline and dossier still work.</div>}
      <div className="glass map-legend" aria-hidden>
        {layers.has('conflict') && (
          <>
            <div><i style={{ borderColor: '#ff8a3d' }} /> Documented line (Sirte–al-Jufra, Philadelphi)</div>
            <div><span style={{ width: 18, height: 10, background: 'rgba(255,77,94,0.18)', border: '1px dashed rgba(255,77,94,0.6)', display: 'inline-block' }} /> Indicative theater area, not a control map</div>
          </>
        )}
        {layers.has('maritime') && <div><i style={{ borderColor: '#19d3c5' }} /> Suez to Bab el-Mandeb shipping lane</div>}
        {(layers.has('movements') || layers.has('inbound')) && <div><span style={{ width: 18, height: 2, background: 'linear-gradient(90deg,transparent,#00aaff)', display: 'inline-block' }} /> Travel arc (origin to destination)</div>}
        <div className="faint">Marker size = number of events at that place</div>
      </div>
    </>
  );
}

function esc(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
