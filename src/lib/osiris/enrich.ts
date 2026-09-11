/**
 * Post-merge enrichment: trip context, diplomatic linkage for conflict items,
 * the partner ranking and the dossier status line.
 */

import type { OsirisEvent, PartnerRank, Store, Theater } from './types';
import { CAIRO, countryName } from './gazetteer';
import { POSITIONS, THEATER_THEMES, THEME_POSTURE } from '@/config/positions';

const DAY = 86_400_000;
const t = (e: OsirisEvent) => Date.parse(e.date);
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' });

/**
 * While Sisi is abroad, "receives"/"meets" items describe meetings at the
 * trip location, not visits to Cairo. Trips are opened by an outbound
 * movement and closed by a return or after four days.
 */
export function applyTripContext(events: OsirisEvent[]): OsirisEvent[] {
  const trips = events
    .filter(e => e.category === 'movement' && e.involvesSisi && !e.upcoming && e.location.name !== 'Cairo' && e.partner && e.partner !== 'EG')
    .sort((a, b) => t(a) - t(b));
  const returns = events.filter(e => e.category === 'movement' && e.location.name === 'Cairo').map(t);

  return events.map(e => {
    if (!(e.involvesSisi && (e.category === 'inbound' || (e.category === 'diplomatic' && e.contactType === 'meeting')))) return e;
    const et = t(e);
    const trip = [...trips].reverse().find(tr => {
      const start = t(tr) - 6 * 3_600_000;
      const ret = returns.find(r => r > t(tr));
      const end = Math.min(ret ?? Infinity, t(tr) + 4 * DAY);
      return et >= start && et <= end;
    });
    if (!trip) return e;
    // Visits hosted at a named Egyptian venue stay inbound.
    if (e.category === 'inbound' && e.location.name !== 'Cairo') return e;
    return { ...e, category: 'diplomatic', contactType: 'meeting', location: { ...trip.location }, origin: undefined };
  });
}

/** Links conflict/maritime items to Egyptian diplomatic activity on the same theater. */
export function applyLinkage(events: OsirisEvent[]): OsirisEvent[] {
  const diplomatic = events.filter(e => (e.involvesSisi || e.relatedEntities.includes('EG')) && ['diplomatic', 'movement', 'inbound'].includes(e.category) && e.theaters.length);
  return events.map(e => {
    if (e.category !== 'conflict' && e.category !== 'maritime') return e;
    const theaters = e.theaters.length ? e.theaters : (e.category === 'maritime' ? (['red-sea'] as Theater[]) : []);
    if (!theaters.length) return e;
    const et = t(e);
    const matches = diplomatic
      .filter(d => d.theaters.some(th => theaters.includes(th)) && t(d) >= et - 21 * DAY && t(d) <= et + 7 * DAY)
      .sort((a, b) => Math.abs(t(a) - et) - Math.abs(t(b) - et));
    if (matches.length) {
      const d = matches[0];
      return {
        ...e,
        theaters,
        diplomaticLinkage: `Egyptian diplomatic track: “${d.title}” (${fmt(d.date)})${matches.length > 1 ? `, plus ${matches.length - 1} related engagement${matches.length > 2 ? 's' : ''} in the surrounding weeks` : ''}.`,
        linkedEventIds: matches.slice(0, 4).map(m => m.id),
        linkageKind: 'dynamic',
      };
    }
    const theme = THEATER_THEMES[theaters[0]][0];
    const latest = POSITIONS.filter(p => p.theme === theme).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return e;
    return {
      ...e,
      theaters,
      diplomaticLinkage: `No tracked Egyptian engagement on ${THEME_POSTURE[theme].title} in the surrounding weeks. Standing position: ${latest.label} (${fmt(latest.date)}, ${latest.sourceName}).`,
      linkageKind: 'standing',
    };
  });
}

export function rankPartners(events: OsirisEvent[], now = Date.now()): PartnerRank[] {
  const since = now - 90 * DAY;
  const acc = new Map<string, PartnerRank>();
  const seen = new Set<string>();
  for (const e of events) {
    if (!e.partner || e.partner === 'EG' || t(e) < since || t(e) > now + DAY || e.upcoming) continue;
    if (!e.involvesSisi) continue;
    const kind = e.category === 'movement' ? 'out' : e.category === 'inbound' && e.contactType === 'visit' ? 'in' : e.contactType === 'call' || e.contactType === 'meeting' ? 'contact' : null;
    if (!kind) continue;
    // One count per partner per direction per day.
    const key = `${e.partner}|${kind}|${e.date.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = acc.get(e.partner) ?? { code: e.partner, name: countryName(e.partner), visitsOut: 0, visitsIn: 0, contacts: 0, total: 0, lastContact: e.date };
    if (kind === 'out') r.visitsOut++;
    if (kind === 'in') {
      r.visitsIn++;
      if (!r.lastInboundVisit || e.date > r.lastInboundVisit) r.lastInboundVisit = e.date;
    }
    if (kind === 'contact') r.contacts++;
    r.total = r.visitsOut + r.visitsIn;
    if (e.date > r.lastContact) r.lastContact = e.date;
    acc.set(e.partner, r);
  }
  return [...acc.values()]
    .filter(r => r.total > 0 || r.contacts > 0)
    .sort((a, b) => b.total - a.total || b.contacts - a.contacts || b.lastContact.localeCompare(a.lastContact));
}

export function buildStatus(events: OsirisEvent[], now = Date.now()): Store['status'] {
  const past = events.filter(e => t(e) <= now + 3_600_000 && !e.upcoming);
  const appearance = past.find(e => e.involvesSisi && e.contactType !== 'call' && ['movement', 'inbound', 'ceremonial', 'domestic', 'diplomatic', 'economic'].includes(e.category) && e.contactType !== 'statement');
  const statement = past.find(e => e.involvesSisi && e.contactType === 'statement');
  // Announced engagements from the last ten days that have not yet happened.
  const upcoming = events
    .filter(e => e.upcoming && e.involvesSisi && t(e) >= now - 10 * DAY)
    .filter(u => !past.some(p => p.partner && p.partner === u.partner && t(p) > t(u) && ['movement', 'inbound', 'diplomatic'].includes(p.category) && p.contactType !== 'call'));
  return {
    lastAppearance: appearance && { id: appearance.id, title: appearance.title, date: appearance.date, place: appearance.location.name },
    lastStatement: statement && { id: statement.id, title: statement.title, date: statement.date },
    nextEngagement: upcoming[0] && { id: upcoming[0].id, title: upcoming[0].title, date: upcoming[0].date },
  };
}

/** Keeps movement arcs honest: inbound with no known origin gets none. */
export function normalizeOrigins(events: OsirisEvent[]): OsirisEvent[] {
  return events.map(e => (e.category === 'movement' && !e.origin && e.location.name !== CAIRO.name ? { ...e, origin: { ...CAIRO } } : e));
}
