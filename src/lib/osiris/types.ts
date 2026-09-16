/**
 * Osiris File — unified event schema.
 *
 * Every item the tool shows (Sisi's own movements, inbound visits to Cairo,
 * conflict items, maritime items, news) normalizes into OsirisEvent. The map,
 * the timeline and the dossier are three views over one array of these.
 *
 * The first block of fields is the contract from the build brief and is kept
 * exactly. Everything after it is optional enrichment the views use.
 */

export type Category =
  | 'movement'    // Sisi's own trips and domestic appearances outside Cairo
  | 'inbound'     // heads of state / officials visiting Egypt
  | 'diplomatic'  // calls, talks, statements on foreign affairs (no travel)
  | 'conflict'    // Libya / Gaza / Sudan / Gulf-war items
  | 'maritime'    // Red Sea / Suez / shipping
  | 'economic'    // IMF, investment, FX, trade
  | 'ceremonial'  // inaugurations, national days, military graduations
  | 'domestic';   // governance meetings and domestic appearances

export type SourceTier = 'state' | 'corroborated';

export type Theater = 'gaza' | 'libya' | 'sudan' | 'gulf' | 'red-sea' | 'nile' | 'horn';

export interface SourceRef {
  name: string;
  url: string;
  /** state = Egyptian state outlet (Presidency, SIS, MENA). */
  kind: 'state' | 'independent';
  /** Where the ingest found it: 'presidency-rss', 'gdelt-doc', etc. */
  feed: string;
  publishedAt?: string;
}

export interface OsirisEvent {
  // ── Contract fields (build brief) ──────────────────────────────
  id: string;
  /** ISO 8601 */
  date: string;
  category: Category;
  title: string;
  summary: string;
  location: { lat: number; lng: number; name: string };
  source: { name: string; url: string; tier: SourceTier };
  /** Countries (ISO-3166 alpha-2, plus EU/UN/AU/AL) and named people. */
  relatedEntities: string[];
  diplomaticLinkage?: string;

  // ── Enrichment ─────────────────────────────────────────────────
  /** Every outlet that carried this event, after de-duplication. */
  sources: SourceRef[];
  /** Number of distinct independent (non-state) outlets. */
  independentCount: number;
  theaters: Theater[];
  /** Partner country for relationship ranking, ISO-2. */
  partner?: string;
  /** For movement/inbound: where the travelling party came from. */
  origin?: { lat: number; lng: number; name: string };
  /** True when Sisi personally is the subject (vs. Egypt generally). */
  involvesSisi: boolean;
  /** How the contact happened, where that is knowable from the text. */
  contactType?: 'visit' | 'meeting' | 'call' | 'statement';
  /** Event looks forward (announced visit, scheduled summit). */
  upcoming?: boolean;
  /** Ids of the diplomatic events a conflict item is linked to. */
  linkedEventIds?: string[];
  /** 'dynamic' = matched to a tracked diplomatic event; 'standing' = the
   *  documented standing Egyptian position on that theater. */
  linkageKind?: 'dynamic' | 'standing';
  /** When this event first entered the store (drives "new since last visit"). */
  firstSeen: string;
  analystRead?: AnalystRead;
}

export interface PositionBasis {
  id: string;
  label: string;
  date: string;
  sourceName: string;
  sourceUrl: string;
}

export interface AnalystRead {
  /** Always rendered under the "Analyst Read" label, never as a quote. */
  posture: string;
  basis: PositionBasis[];
  /** A comparable earlier event from the store, when one exists. */
  comparable?: { id: string; title: string; date: string };
  method: 'rules' | 'gemini';
  generatedAt: string;
}

/** Distributional context for a score against the static comparison set. */
export interface RiskContext {
  /** Number of countries in the comparison set. */
  n: number;
  mean: number;
  median: number;
  /** 25th percentile. */
  q1: number;
  /** 75th percentile. */
  q3: number;
  min: number;
  max: number;
  /** Where this score ranks among the comparison set, 0-100. */
  percentile: number;
}

export interface RiskBreakdown {
  code: string;
  name: string;
  score: number;
  level: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  components: { key: string; label: string; value: number; weight: number; note: string }[];
  tags: string[];
  /** Only set for entries this app also positions against the comparison set (Egypt). */
  context?: RiskContext;
}

export interface PartnerRank {
  code: string;
  name: string;
  visitsOut: number;
  visitsIn: number;
  /** Phone calls and meetings held in third countries. */
  contacts: number;
  total: number;
  lastContact: string;
  lastInboundVisit?: string;
}

export interface SourceHealth {
  id: string;
  name: string;
  ok: boolean;
  items: number;
  ms: number;
  error?: string;
  note?: string;
}

export interface Briefing {
  text: string;
  method: 'gemini' | 'rules';
  generatedAt: string;
  model?: string;
}

export interface MaritimeFeature {
  id: string;
  kind: 'chokepoint' | 'port' | 'vessel';
  name: string;
  lat: number;
  lng: number;
  note?: string;
  country?: string;
}

export interface Store {
  version: 1;
  generatedAt: string;
  /** 'live' = fresh ingest; 'snapshot' = committed fallback data. */
  mode: 'live' | 'snapshot' | 'mixed';
  events: OsirisEvent[];
  briefing: Briefing;
  risk: RiskBreakdown[];
  partners: PartnerRank[];
  maritime: { features: MaritimeFeature[]; vesselCount: number; vesselSource: string };
  health: SourceHealth[];
  status: {
    lastAppearance?: { id: string; title: string; date: string; place: string };
    lastStatement?: { id: string; title: string; date: string };
    nextEngagement?: { id: string; title: string; date: string };
  };
  heroImage: { url: string; alt: string; caption: string; sourceUrl: string };
}

/** Raw item as a source adapter emits it, before classification. */
export interface RawItem {
  title: string;
  summary: string;
  url: string;
  date: string;
  sourceName: string;
  kind: 'state' | 'independent';
  feed: string;
  /** Coordinates when the upstream geocoded the item (GDELT events). */
  geo?: { lat: number; lng: number; name: string };
  /** Extra classification hint from the adapter (e.g. GDELT QuadClass). */
  hint?: { quad?: number; goldstein?: number; country?: string };
}
