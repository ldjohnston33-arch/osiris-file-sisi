import { NextResponse } from 'next/server';
import type { Feature, FeatureCollection } from 'geojson';
import { THEATER_DEFS, circle } from '@/lib/osiris/geometry';

/**
 * Conflict geometry for Libya, Gaza and Sudan as GeoJSON.
 *
 * Upstream Osiris served DeepState's Ukraine frontline here. No free, keyless
 * frontline source exists for these theaters, so this serves only documented
 * lines (Sirte–al-Jufra, Philadelphi), approximate outlines, indicative
 * theater halos and key sites. Nothing here depicts territorial control.
 */
export async function GET() {
  const features: Feature[] = [];
  for (const t of THEATER_DEFS) {
    const ring = t.outline ?? (t.radiusKm ? circle(t.center, t.radiusKm) : null);
    if (ring) features.push({ type: 'Feature', properties: { kind: t.outline ? 'outline' : 'halo', theater: t.id, label: t.label, note: t.outline ? 'Approximate outline' : 'Indicative theater area, not a control map' }, geometry: { type: 'Polygon', coordinates: [ring] } });
    for (const l of t.lines) features.push({ type: 'Feature', properties: { kind: 'line', theater: t.id, id: l.id, label: l.label, note: l.note }, geometry: { type: 'LineString', coordinates: l.coords } });
    for (const s of t.sites) features.push({ type: 'Feature', properties: { kind: 'site', theater: t.id, id: s.id, label: s.name, note: s.note }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } });
  }
  return NextResponse.json({ type: 'FeatureCollection', features }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
}
