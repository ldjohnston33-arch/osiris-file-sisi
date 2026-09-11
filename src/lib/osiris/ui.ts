/** Client-safe display helpers shared by every view. */

import type { Category, OsirisEvent, Theater } from './types';

export interface CategoryMeta {
  label: string;
  short: string;
  color: string;
  glow: string;
  /** Category family drives the colour wash on cards and drawers. */
  family: 'diplomatic' | 'conflict' | 'economic' | 'ceremonial' | 'maritime' | 'domestic';
  lane: number;
}

export const CATEGORY: Record<Category, CategoryMeta> = {
  movement:   { label: 'Sisi’s movements', short: 'Movement',   color: '#00aaff', glow: 'rgba(0,170,255,0.55)',   family: 'diplomatic', lane: 0 },
  inbound:    { label: 'Inbound visits',    short: 'Inbound',    color: '#8f7bff', glow: 'rgba(143,123,255,0.55)', family: 'diplomatic', lane: 1 },
  diplomatic: { label: 'Diplomacy',         short: 'Diplomatic', color: '#4f8bff', glow: 'rgba(79,139,255,0.5)',   family: 'diplomatic', lane: 1 },
  conflict:   { label: 'Conflict',          short: 'Conflict',   color: '#ff4d5e', glow: 'rgba(255,77,94,0.55)',   family: 'conflict',   lane: 2 },
  maritime:   { label: 'Red Sea / Suez',    short: 'Maritime',   color: '#19d3c5', glow: 'rgba(25,211,197,0.5)',   family: 'maritime',   lane: 3 },
  economic:   { label: 'Economy',           short: 'Economic',   color: '#3ddc97', glow: 'rgba(61,220,151,0.5)',   family: 'economic',   lane: 3 },
  ceremonial: { label: 'Ceremonial',        short: 'Ceremonial', color: '#f5b942', glow: 'rgba(245,185,66,0.5)',   family: 'ceremonial', lane: 0 },
  domestic:   { label: 'Domestic',          short: 'Domestic',   color: '#9aaac0', glow: 'rgba(154,170,192,0.4)',  family: 'domestic',   lane: 0 },
};

export const CATEGORY_ORDER: Category[] = ['movement', 'inbound', 'diplomatic', 'conflict', 'maritime', 'economic', 'ceremonial', 'domestic'];

export const LANES = ['Sisi', 'Diplomacy', 'Conflict', 'Economy & sea'];

export const THEATER_LABEL: Record<Theater, string> = {
  gaza: 'Gaza', libya: 'Libya', sudan: 'Sudan', gulf: 'Gulf war / Iran', 'red-sea': 'Red Sea / Suez', nile: 'Nile / GERD', horn: 'Horn of Africa',
};

export type LayerId = 'movements' | 'inbound' | 'conflict' | 'maritime';

export const LAYERS: { id: LayerId; label: string; color: string; hint: string }[] = [
  { id: 'movements', label: 'Sisi’s movements', color: '#00aaff', hint: 'Trips abroad, domestic tours, meetings held abroad' },
  { id: 'inbound', label: 'Inbound visits to Cairo', color: '#8f7bff', hint: 'Heads of state and officials received in Egypt' },
  { id: 'conflict', label: 'Libya · Gaza · Sudan', color: '#ff4d5e', hint: 'Conflict items, documented lines and key sites, each tagged with its Egyptian diplomatic linkage' },
  { id: 'maritime', label: 'Red Sea / Suez', color: '#19d3c5', hint: 'Ports, chokepoints, shipping lane, vessel density when AIS is enabled' },
];

/** Which map layer an event belongs to (undefined = timeline only). */
export function layerFor(e: OsirisEvent): LayerId | undefined {
  if (e.category === 'movement') return 'movements';
  if (e.category === 'diplomatic' && e.involvesSisi && e.contactType === 'meeting' && e.location.name !== 'Cairo' && !/Egypt|Cairo|Alamein|Sharm|Capital|Ittihadiya/.test(e.location.name)) return 'movements';
  if (e.category === 'inbound') return 'inbound';
  if (e.category === 'conflict') return 'conflict';
  if (e.category === 'maritime') return 'maritime';
  return undefined;
}

const TZ = 'Africa/Cairo';
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
export const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }) + ' Cairo';

export function relTime(iso: string, now = Date.now()): string {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export const daysBetween = (a: number, b: number) => Math.floor(Math.abs(a - b) / 86_400_000);

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
