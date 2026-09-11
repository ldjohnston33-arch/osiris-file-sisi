/**
 * Keyword classification, run once per item on ingest.
 *
 * v1 is deliberately rule-based: the AI endpoints are rate-limited (5 req/min)
 * and reserved for the briefing and Analyst Read. Rules are ordered; the first
 * that fires sets the category. Each rule is small enough to audit by eye.
 */

import type { Category, OsirisEvent, RawItem, Theater } from './types';
import { CAIRO, countryByCode, findCountries, findCountriesOrdered, findLeaders, hasTerm, PLACES } from './gazetteer';

export const SISI_RE = /\b(el-?sisi|al-?sisi|el-?sissi|sisi|sissi|egyptian president|egypt['’]s president|president of egypt)\b/i;

const CALL_RE = /\b(phone call|phone conversation|telephone|call from|call with|calls? (?:with|from)|video ?conference|videoconference|received a call|receives? a call|phoned)\b/i;
const OUTBOUND_RE = /\b(arrives?|arrived|lands?|landed|heads? (?:to|for)|headed (?:to|for)|departs? (?:for|to)|leaves? for|left for|travels? to|travelled to|traveled to|kicks off|begins? (?:an? )?(?:official |state |working )?(?:visit|tour)|(?:official|state|working) visit to|visits?|visited|tour of|participates? in|attends?|attended|takes? part in|addresses|addressed)\b/i;
const INBOUND_VERB_RE = /\b(receives?|received|welcomes?|welcomed|hosts?|hosted|meets? with|met with|meets|holds? talks with|held talks with|holds? (?:a )?(?:summit|meeting)|bilateral (?:talks|meeting))\b/i;
const FOREIGN_ARRIVAL_RE = /\b(arrives? in|arrived in|lands? in|visits?|visited|to visit)\s+(?:cairo|egypt|el alamein|el-alamein|new alamein|sharm el-sheikh|sharm el sheikh|the new administrative capital)\b/i;
const RETURN_RE = /\b(returns? (?:home|to cairo|to egypt)|returned (?:home|to cairo)|concludes? (?:his |an? )?(?:official |state |working )?(?:visit|tour|trip))\b/i;
const SIDELINES_RE = /\b(sidelines|on the margins|margins of)\b/i;
const UPCOMING_RE = /\b(will (?:visit|travel|attend|host|participate|head|receive|take part|chair|co-chair|deliver)|to (?:visit|attend|host|participate in|head to|take part in|chair|co-chair|travel to)\b|is set to|are set to|scheduled|next week|tomorrow|expected to (?:visit|arrive|attend|host))\b/i;
const CEREMONIAL_RE = /\b(inaugurat\w*|opening ceremony|opens|ceremony|graduat\w*|celebrat\w*|anniversary|commemorat\w*|national day|awards?|honou?rs?|condolence\w*|funeral|credentials|sworn|swearing|military academy|police academy|iftar|eid|mawlid|festival|laying the foundation|foundation stone)\b/i;
const STATEMENT_RE = /\b(stresses|stressed|affirms|affirmed|reaffirms|calls for|called for|urges|urged|warns|warned|condemns|condemned|welcomes|welcomed|rejects|rejected|says|said|asserts|asserted|emphasi[sz]es|emphasi[sz]ed|underlines|underscores|reiterates|reiterated|speech|address(?:es)?|remarks|statement)\b/i;
const CONFLICT_RE = /\b(strikes?|airstrikes?|attacks?|attacked|killed|killing|clash\w*|offensive|fighting|shelling|drone|troops|militia|ceasefire|truce|hostages?|siege|famine|displace\w*|refugees?|war|frontlines?|captured|advance[sd]?|withdraw\w*|bombard\w*|missiles?|casualt\w*|massacre|shell(?:ed|ing)|rsf|armed|invasion|incursion|escalat\w*)\b/i;
const MARITIME_RE = /\b(red sea|suez canal|canal revenue|bab el-mandeb|bab al-mandab|bab el mandeb|shipping|ships?|vessels?|tankers?|maritime|container line|maersk|transits?|port said|ain sokhna|sokhna|freight|navigation|lng carrier|naval)\b/i;
const ECONOMIC_RE = /\b(imf|world bank|investment|investments|investors?|loan|debt|inflation|pound|exchange rate|currency|bonds?|eurobond|sukuk|gdp|growth|budget|deficit|reserves|remittances|tourism revenue|trade|exports?|imports?|economic|economy|privati[sz]ation|stock|egx|central bank|interest rates?|swap|financing|billion|million|megaproject|industrial zone|sczone|economic zone|energy deal|gas deal|lng)\b/i;

export const THEATER_TERMS: Record<Theater, string[]> = {
  gaza: ['gaza', 'rafah', 'hamas', 'philadelphi', 'kerem shalom', 'khan younis', 'gazans', 'palestinian', 'palestinians', 'west bank', 'hostage', 'hostages'],
  libya: ['libya', 'libyan', 'tripoli', 'benghazi', 'haftar', 'dbeibah', 'sirte', 'jufra', 'misrata', 'lna'],
  sudan: ['sudan', 'sudanese', 'khartoum', 'rsf', 'rapid support forces', 'burhan', 'darfur', 'el fasher', 'el-fasher', 'kordofan', 'port sudan', 'omdurman'],
  gulf: ['iran', 'iranian', 'tehran', 'irgc', 'gulf conflict', 'gulf war', 'hormuz', 'strait of hormuz'],
  'red-sea': ['red sea', 'suez canal', 'bab el-mandeb', 'bab al-mandab', 'houthi', 'houthis', 'hodeidah', 'damietta', 'canal revenue', 'shipping'],
  nile: ['gerd', 'renaissance dam', 'nile', 'water security', 'ethiopia', 'ethiopian'],
  horn: ['somalia', 'somali', 'eritrea', 'djibouti', 'horn of africa', 'aussom', 'somaliland'],
};

/** Map anchor for items that name a theater but no specific place. */
export const THEATER_ANCHORS: Record<Theater, { name: string; lat: number; lng: number }> = {
  gaza: { name: 'Gaza Strip', lat: 31.42, lng: 34.37 },
  libya: { name: 'Libya', lat: 30.2, lng: 17.5 },
  sudan: { name: 'Sudan', lat: 15.5, lng: 30.5 },
  gulf: { name: 'Persian Gulf', lat: 26.8, lng: 52.0 },
  'red-sea': { name: 'Red Sea', lat: 20.0, lng: 38.5 },
  nile: { name: 'GERD / Blue Nile', lat: 11.215, lng: 35.0932 },
  horn: { name: 'Horn of Africa', lat: 8.0, lng: 45.0 },
};

export function findTheaters(text: string): Theater[] {
  return (Object.keys(THEATER_TERMS) as Theater[]).filter(t => THEATER_TERMS[t].some(term => hasTerm(text, term)));
}

function allPlaces(text: string) {
  return PLACES.filter(p => p.terms.some(t => hasTerm(text, t)));
}

/** "the President" in Presidency/SIS copy always means Sisi. */
function mentionsSisi(item: RawItem, text: string) {
  if (SISI_RE.test(text)) return true;
  if (item.feed === 'presidency-rss' || item.feed === 'presidency-html') return true;
  if (item.kind === 'state' && /\b(the president|president)\b/i.test(item.title) && !/\b(president of|[A-Z][a-z]+ president)\b/.test(item.title)) return true;
  return false;
}

/** Subject-before-verb test: does `a` appear before the first match of `re`? */
function precedes(text: string, a: RegExp, re: RegExp) {
  const ai = text.search(a);
  const vi = text.search(re);
  return ai >= 0 && vi >= 0 && ai < vi;
}

export function stableId(item: RawItem): string {
  const basis = (item.url || '') + '|' + item.title.toLowerCase().replace(/\W+/g, ' ').trim();
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < basis.length; i++) {
    const c = basis.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

export function cleanText(s: string, max = 380): string {
  const t = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#822[01];/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

export function classify(item: RawItem, now = new Date()): OsirisEvent {
  const title = cleanText(item.title, 220);
  const summary = cleanText(item.summary || '', 380);
  const text = `${title}. ${summary}`;
  const titleOnly = title;

  const involvesSisi = mentionsSisi(item, text);
  const theaters = findTheaters(text);
  const countries = findCountries(text).filter(c => c !== 'EG');
  const leaders = findLeaders(text);
  const places = allPlaces(text);
  const foreignPlaces = places.filter(p => p.country !== 'EG');
  const egyptPlaces = places.filter(p => p.country === 'EG' && p.name !== 'Rafah crossing');
  const upcoming = UPCOMING_RE.test(titleOnly);

  let category: Category;
  let contactType: OsirisEvent['contactType'];
  let partner: string | undefined;
  let location = { ...CAIRO };
  let origin: OsirisEvent['origin'];

  const firstForeign = () => {
    // Earliest-mentioned country in the title, skipping countries that are
    // only there as a theater (Gaza → PS) when a real counterpart is named.
    const inTitle = findCountriesOrdered(titleOnly).filter(c => c !== 'EG');
    const theaterOnly = new Set(['PS', 'IL', 'YE', 'IR']);
    return inTitle.find(c => !theaterOnly.has(c)) ?? inTitle[0] ?? countries[0];
  };
  const egyptActor = /^(egypt|egyptian|cairo)\b/i.test(titleOnly) && STATEMENT_RE.test(titleOnly);
  const capitalOf = (code?: string) => {
    const c = code ? countryByCode(code) : undefined;
    return c ? { name: c.capital.name, lat: c.capital.lat, lng: c.capital.lng } : undefined;
  };

  if (involvesSisi && CALL_RE.test(text)) {
    // 1. Phone and video calls: contact without travel.
    category = 'diplomatic';
    contactType = 'call';
    partner = firstForeign();
    location = capitalOf(partner) ?? location;
  } else if (involvesSisi && RETURN_RE.test(titleOnly)) {
    // 2a. Returning home closes a trip.
    category = 'movement';
    contactType = 'visit';
    location = { ...CAIRO };
  } else if (
    involvesSisi &&
    OUTBOUND_RE.test(titleOnly) &&
    !FOREIGN_ARRIVAL_RE.test(titleOnly) &&
    !(INBOUND_VERB_RE.test(titleOnly) && titleOnly.search(INBOUND_VERB_RE) < titleOnly.search(OUTBOUND_RE)) &&
    (foreignPlaces.length > 0 || firstForeign() !== undefined)
  ) {
    // 2b. Sisi travelling abroad.
    const dest = foreignPlaces.find(p => !['PS', 'IL'].includes(p.country)) ?? foreignPlaces[0];
    partner = dest ? dest.country : firstForeign();
    category = 'movement';
    contactType = 'visit';
    location = dest ? { name: dest.name, lat: dest.lat, lng: dest.lng } : (capitalOf(partner) ?? location);
    origin = { ...CAIRO };
  } else if (involvesSisi && INBOUND_VERB_RE.test(titleOnly) && (countries.length > 0 || leaders.length > 0) && (SIDELINES_RE.test(text) || foreignPlaces.some(p => !['PS', 'LY', 'SD', 'IL'].includes(p.country)))) {
    // 3a. Meetings held abroad (summit sidelines). The store later moves these
    //     onto the active trip's location when one is known.
    partner = firstForeign();
    category = 'diplomatic';
    contactType = 'meeting';
    const p = foreignPlaces.find(fp => !['PS', 'LY', 'SD', 'IL'].includes(fp.country));
    location = p ? { name: p.name, lat: p.lat, lng: p.lng } : (capitalOf(partner) ?? location);
  } else if (
    (involvesSisi && INBOUND_VERB_RE.test(titleOnly) && (countries.length > 0 || leaders.length > 0) && !/credentials/i.test(text)) ||
    (FOREIGN_ARRIVAL_RE.test(titleOnly) && !precedes(titleOnly, SISI_RE, FOREIGN_ARRIVAL_RE))
  ) {
    // 3b. Foreign leaders / officials received in Egypt.
    partner = firstForeign();
    const isHeadLevel = /\b(president|king|emir|crown prince|prime minister|chancellor|sultan|sheikh|premier|vice president|secretary-general)\b/i.test(titleOnly);
    category = 'inbound';
    contactType = isHeadLevel || FOREIGN_ARRIVAL_RE.test(titleOnly) ? 'visit' : 'meeting';
    const venue = egyptPlaces[0];
    location = venue ? { name: venue.name, lat: venue.lat, lng: venue.lng } : { ...CAIRO };
    origin = capitalOf(partner);
  } else if (egyptActor && !involvesSisi) {
    // 3c. Egypt (the state) takes a position: condemns, welcomes, rejects…
    category = 'diplomatic';
    contactType = 'statement';
    partner = firstForeign();
  } else if (!involvesSisi && theaters.some(t => t === 'gaza' || t === 'libya' || t === 'sudan' || t === 'gulf') && CONFLICT_RE.test(text) && !(MARITIME_RE.test(titleOnly) && theaters.includes('red-sea'))) {
    // 4. Conflict items with no direct Sisi involvement.
    category = 'conflict';
    const t = theaters.find(x => x !== 'red-sea' && x !== 'nile' && x !== 'horn') ?? theaters[0];
    const p = foreignPlaces.find(fp => ['PS', 'LY', 'SD', 'IR', 'IL', 'YE'].includes(fp.country)) ?? places.find(pl => pl.name === 'Rafah crossing');
    location = p ? { name: p.name, lat: p.lat, lng: p.lng } : { ...THEATER_ANCHORS[t] };
    partner = undefined;
  } else if (MARITIME_RE.test(text) && (theaters.includes('red-sea') || /suez|red sea|bab el|port said|sokhna|damietta/i.test(text))) {
    // 5. Red Sea / Suez / shipping.
    category = 'maritime';
    const p = places.find(pl => ['Bab el-Mandeb', 'Port Said', 'Ain Sokhna', 'Ismailia', 'Damietta', 'Hodeidah', 'Jeddah', 'Aden', 'Berbera'].includes(pl.name));
    location = p
      ? { name: p.name, lat: p.lat, lng: p.lng }
      : /bab el|houthi|yemen|aden/i.test(text)
        ? { name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33 }
        : { name: 'Suez Canal', lat: 30.5852, lng: 32.2654 };
  } else if (CEREMONIAL_RE.test(titleOnly)) {
    // 6. Ceremonial.
    category = 'ceremonial';
    const venue = egyptPlaces[0] ?? foreignPlaces[0];
    if (venue) location = { name: venue.name, lat: venue.lat, lng: venue.lng };
  } else if (ECONOMIC_RE.test(titleOnly) && !theaters.length) {
    // 7. Economic.
    category = 'economic';
    partner = firstForeign();
    const venue = egyptPlaces[0];
    if (venue) location = { name: venue.name, lat: venue.lat, lng: venue.lng };
  } else if (countries.length > 0 || theaters.length > 0) {
    // 8. Foreign-policy statements and talks.
    category = theaters.length && !involvesSisi && CONFLICT_RE.test(text) ? 'conflict' : 'diplomatic';
    contactType = STATEMENT_RE.test(titleOnly) ? 'statement' : undefined;
    partner = firstForeign();
    if (category === 'conflict') {
      const t = theaters[0];
      location = { ...THEATER_ANCHORS[t] };
    } else if (egyptPlaces[0]) {
      location = { name: egyptPlaces[0].name, lat: egyptPlaces[0].lat, lng: egyptPlaces[0].lng };
    }
  } else {
    // 9. Domestic governance and appearances.
    category = ECONOMIC_RE.test(text) ? 'economic' : 'domestic';
    contactType = STATEMENT_RE.test(titleOnly) ? 'statement' : undefined;
    const venue = egyptPlaces[0];
    if (venue) location = { name: venue.name, lat: venue.lat, lng: venue.lng };
    // Sisi touring a site outside Cairo is a movement.
    if (involvesSisi && venue && venue.name !== 'Cairo' && /\b(inspects?|inspected|visits?|visited|tours?|toured|arrives?|witness(?:es)?)\b/i.test(titleOnly)) {
      category = 'movement';
      contactType = 'visit';
      origin = { ...CAIRO };
    }
  }

  // Upstream geocoding (GDELT) beats keyword placement for non-diplomatic items.
  if (item.geo && (category === 'conflict' || category === 'maritime')) {
    location = { ...item.geo };
  }

  if (contactType === undefined && involvesSisi && STATEMENT_RE.test(titleOnly) && category !== 'movement' && category !== 'inbound') {
    contactType = 'statement';
  }

  const mentionsEgypt = /\b(egypt|egyptian|cairo)\b/i.test(text) || involvesSisi;
  const relatedEntities = [...new Set([...(partner ? [partner] : []), ...countries, ...(mentionsEgypt ? ['EG'] : []), ...leaders])];

  return {
    id: stableId(item),
    date: safeIso(item.date, now),
    category,
    title,
    summary: summary || title,
    location,
    source: { name: item.sourceName, url: item.url, tier: item.kind === 'state' ? 'state' : 'corroborated' },
    relatedEntities,
    sources: [{ name: item.sourceName, url: item.url, kind: item.kind, feed: item.feed, publishedAt: item.date }],
    independentCount: item.kind === 'independent' ? 1 : 0,
    theaters,
    partner,
    origin,
    involvesSisi,
    contactType,
    upcoming: upcoming || undefined,
    firstSeen: now.toISOString(),
  };
}

export function safeIso(d: string, now = new Date()): string {
  const t = Date.parse(d);
  if (Number.isNaN(t)) return now.toISOString();
  // Clamp feed dates that claim to be in the future (bad timezone metadata).
  return new Date(Math.min(t, now.getTime() + 36e5)).toISOString();
}
