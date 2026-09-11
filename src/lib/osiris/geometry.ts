/**
 * Static geometry for the conflict and maritime layers.
 *
 * There is no free, keyless source of frontline geometry for Libya, Gaza or
 * Sudan (Osiris's /api/frontlines reads DeepState, which is Ukraine-only;
 * ACLED requires registration). So this layer shows only lines and places
 * that are well-defined and publicly documented, and labels theater areas as
 * indicative, never as territorial-control maps.
 */

import type { MaritimeFeature, Theater } from './types';

type LngLat = [number, number];

export interface TheaterDef {
  id: Theater;
  label: string;
  center: LngLat;
  /** Indicative halo radius in km (theaters without a real outline). */
  radiusKm?: number;
  /** Approximate outline where one is well known. */
  outline?: LngLat[];
  lines: { id: string; label: string; coords: LngLat[]; note: string }[];
  sites: { id: string; name: string; lng: number; lat: number; note: string }[];
  egyptLink: string;
}

export const THEATER_DEFS: TheaterDef[] = [
  {
    id: 'gaza',
    label: 'Gaza',
    center: [34.39, 31.42],
    outline: [
      [34.2166, 31.3237], [34.2842, 31.2269], [34.355, 31.294], [34.392, 31.374], [34.4747, 31.4717],
      [34.525, 31.525], [34.568, 31.542], [34.53, 31.586], [34.4906, 31.5967], [34.438, 31.52],
      [34.33, 31.42], [34.28, 31.36], [34.2166, 31.3237],
    ],
    lines: [
      { id: 'philadelphi', label: 'Philadelphi corridor', coords: [[34.2166, 31.3237], [34.248, 31.28], [34.2842, 31.2269]], note: 'Strip along the Egypt–Gaza border, about 14 km. Governed by the Egypt–Israel security arrangements; control of it is a recurring point of friction in ceasefire talks.' },
    ],
    sites: [
      { id: 'rafah', name: 'Rafah crossing', lng: 34.2596, lat: 31.2472, note: 'Only Gaza crossing on the Egyptian border; the main valve for aid and medical evacuations.' },
      { id: 'kerem-shalom', name: 'Kerem Shalom', lng: 34.2839, lat: 31.2266, note: 'Egypt–Israel–Gaza tripoint crossing used for aid trucks inspected on the Israeli side.' },
      { id: 'arish', name: 'El-Arish', lng: 33.7984, lat: 31.1316, note: 'North Sinai staging hub for aid bound for Gaza via Rafah.' },
    ],
    egyptLink: 'Ceasefire mediator with Qatar and the US; controls Rafah; authored the Arab League-adopted reconstruction plan (March 2025).',
  },
  {
    id: 'libya',
    label: 'Libya',
    center: [17.5, 29.5],
    radiusKm: 620,
    lines: [
      { id: 'sirte-jufra', label: 'Sirte–al-Jufra “red line”', coords: [[16.5887, 31.2089], [15.9477, 29.1268]], note: 'Line Sisi declared on 20 June 2020 as the threshold for direct Egyptian intervention.' },
    ],
    sites: [
      { id: 'tripoli', name: 'Tripoli', lng: 13.1913, lat: 32.8872, note: 'Seat of the Government of National Unity.' },
      { id: 'benghazi', name: 'Benghazi', lng: 20.0667, lat: 32.1167, note: 'Eastern power centre; base of Khalifa Haftar’s forces.' },
      { id: 'sirte', name: 'Sirte', lng: 16.5887, lat: 31.2089, note: 'Coastal anchor of the 2020 red line; gateway to the oil crescent.' },
      { id: 'jufra', name: 'Al-Jufra', lng: 15.9477, lat: 29.1268, note: 'Central airbase; southern anchor of the 2020 red line.' },
      { id: 'salloum', name: 'Salloum crossing', lng: 25.1596, lat: 31.5525, note: 'Main Egypt–Libya land border crossing.' },
    ],
    egyptLink: 'Backs eastern-based partners, treats Sirte–al-Jufra as a security boundary, engages Tripoli diplomatically.',
  },
  {
    id: 'sudan',
    label: 'Sudan',
    center: [30.0, 14.8],
    radiusKm: 720,
    lines: [],
    sites: [
      { id: 'port-sudan', name: 'Port Sudan', lng: 37.2164, lat: 19.6158, note: 'Seat of the army-aligned government since 2023.' },
      { id: 'khartoum', name: 'Khartoum', lng: 32.5599, lat: 15.5007, note: 'Capital; contested since war broke out in April 2023.' },
      { id: 'el-fasher', name: 'El Fasher', lng: 25.3494, lat: 13.6279, note: 'North Darfur capital; taken by the RSF in October 2025 after a long siege.' },
      { id: 'el-obeid', name: 'El Obeid', lng: 30.2167, lat: 13.1843, note: 'Kordofan hub on the east–west supply axis.' },
      { id: 'argeen', name: 'Argeen / Qustul crossings', lng: 31.3, lat: 21.95, note: 'Egypt–Sudan land crossings; main route for refugees entering Egypt.' },
    ],
    egyptLink: 'Backs Sudan’s state institutions and army-led authorities; rejects parallel RSF structures; convenes neighbour-led mediation.',
  },
];

export const SHIPPING_LANE: LngLat[] = [
  [32.35, 31.3], [32.33, 30.6], [32.56, 29.93], [33.2, 28.6], [34.0, 27.4], [36.5, 24.5],
  [38.8, 20.5], [41.2, 16.5], [42.7, 13.8], [43.4, 12.6], [45.5, 12.4], [51.0, 12.8],
];

export const MARITIME_STATIC: MaritimeFeature[] = [
  { id: 'suez', kind: 'chokepoint', name: 'Suez Canal', lat: 30.5852, lng: 32.2654, country: 'EG', note: 'Egypt’s largest single FX earner before the Red Sea crisis; Sisi put the 2024 revenue loss at about $7 billion.' },
  { id: 'bab-el-mandeb', kind: 'chokepoint', name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33, country: 'YE', note: 'Southern gate to the Red Sea; Houthi attacks here drive Suez diversions around the Cape.' },
  { id: 'hormuz', kind: 'chokepoint', name: 'Strait of Hormuz', lat: 26.5667, lng: 56.25, country: 'IR', note: 'Gulf energy chokepoint; exposure rose with the Gulf war that began in February 2026.' },
  { id: 'port-said', kind: 'port', name: 'Port Said / East Port Said', lat: 31.2653, lng: 32.3019, country: 'EG', note: 'Northern canal entrance; SCZone container hub.' },
  { id: 'sokhna', kind: 'port', name: 'Ain Sokhna', lat: 29.6, lng: 32.35, country: 'EG', note: 'Southern SCZone port and industrial zone.' },
  { id: 'damietta', kind: 'port', name: 'Damietta', lat: 31.4165, lng: 31.8133, country: 'EG', note: 'LNG terminal; drone strike on a vessel in port on 29 July 2026.' },
  { id: 'alexandria', kind: 'port', name: 'Alexandria', lat: 31.2001, lng: 29.9187, country: 'EG', note: 'Egypt’s main Mediterranean port.' },
  { id: 'safaga', kind: 'port', name: 'Safaga', lat: 26.74, lng: 33.94, country: 'EG', note: 'Red Sea port for bulk and pilgrim traffic.' },
  { id: 'jeddah', kind: 'port', name: 'Jeddah', lat: 21.4858, lng: 39.1925, country: 'SA', note: 'Largest Red Sea port.' },
  { id: 'port-sudan-port', kind: 'port', name: 'Port Sudan', lat: 19.6158, lng: 37.2164, country: 'SD', note: 'Sudan’s main port and wartime seat of government.' },
  { id: 'hodeidah', kind: 'port', name: 'Hodeidah', lat: 14.7978, lng: 42.9545, country: 'YE', note: 'Houthi-held port.' },
  { id: 'djibouti', kind: 'port', name: 'Djibouti', lat: 11.5886, lng: 43.145, country: 'DJ', note: 'Hub for foreign naval bases at the strait.' },
  { id: 'aden', kind: 'port', name: 'Aden', lat: 12.7855, lng: 45.0187, country: 'YE', note: 'Seat of Yemen’s internationally recognised government.' },
  { id: 'aqaba', kind: 'port', name: 'Aqaba / Eilat', lat: 29.53, lng: 35.0, country: 'JO', note: 'Gulf of Aqaba ports.' },
  { id: 'berbera', kind: 'port', name: 'Berbera', lat: 10.4396, lng: 45.0143, country: 'SO', note: 'Somaliland port at the centre of Horn of Africa access disputes.' },
];

/** Circle polygon for indicative theater halos. */
export function circle(center: LngLat, radiusKm: number, steps = 64): LngLat[] {
  const [lng, lat] = center;
  const out: LngLat[] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

/** Great-circle-ish arc between two points for movement lines. */
export function arc(from: LngLat, to: LngLat, steps = 48): LngLat[] {
  const out: LngLat[] = [];
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const lift = Math.min(18, dist * 0.18);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * lift;
    out.push([x, y]);
  }
  return out;
}
