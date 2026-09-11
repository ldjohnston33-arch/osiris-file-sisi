# Osiris File: Sisi

A living leadership profile of Egyptian President Abdel Fattah el-Sisi, built for [L4 Global](https://l4global.com). It tracks his public activity and diplomatic movements, visits to Cairo, and the Libya, Gaza, Sudan and Red Sea context around Egyptian statecraft, and presents them as one event store with three synced views: a dossier, a map and a timeline.

It is the first installment of the Osiris File format; the data model, classifier and UI are written so the next head of state is mostly a configuration change (see [Adding the next leader](#adding-the-next-leader)).

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm test             # classifier, sourcing and guardrail tests
```

The first page load runs a full ingest (about 60 to 90 seconds, mostly GDELT's required 5-second spacing between queries). After that, pages are served from cache.

## Deploy to Vercel (Hobby, no card)

1. Put this folder in a GitHub repository. The easiest route without the command line is **GitHub Desktop**: *File → Add local repository → Publish repository*.
2. On [vercel.com](https://vercel.com) choose **Add New → Project**, pick the repository and press **Deploy**. Vercel detects Next.js; no build settings need changing.
3. Optional environment variables (Project → Settings → Environment Variables), then redeploy:

| Variable | What it turns on | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | AI-written briefing and polished Analyst Read notes | Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `CRON_SECRET` | Locks `/api/ingest`; Vercel Cron sends it automatically | Any long random string |
| `AIS_API_KEY` | Live vessel density on the Red Sea layer | Free key at [aisstream.io](https://aisstream.io) |
| Upstash Redis | Rolling 180-day history and true "first seen" times | Vercel → Storage / Marketplace → Upstash Redis (free) fills the variables in |
| `OSIRIS_STRICT_SOURCING=1` | Counts state-owned outlets such as Ahram as state sources | – |

**No variable is required.** With none set, everything runs on free, keyless sources and the briefing and Analyst Read use the rules-based fallback.

4. After the first deploy, open `/api/ingest/health` to see which sources returned data on the live server.

**Embedding in WordPress:** the site allows iframes from `l4global.com` (see `FRAME_ANCESTORS` in `next.config.ts`). In a post, add a Custom HTML block with `<iframe src="https://YOUR-APP.vercel.app" style="width:100%;height:1600px;border:0"></iframe>`.

**Render fallback:** `npm run build` then `npm start` works on Render's free web service. It sleeps after about 15 idle minutes, so Vercel is the better fit for a page people check casually.

## How "live" works

"Live" means scheduled refresh, which matches how fast the sources actually update.

- The store is cached in Next's data cache for **30 minutes**. The first request after it goes stale is still served instantly from the old copy while a background regeneration runs the ingest. Page views never hit upstream sources directly.
- The page itself regenerates at most every 15 minutes, and open tabs poll `/api/events` every 15 minutes, so a long-open tab picks up new data.
- **Vercel Hobby limits cron jobs to once a day**, so `vercel.json` has one daily warm-up. For strictly time-driven refreshes every 30 minutes, the included GitHub Action (`.github/workflows/refresh.yml`) pings `/api/ingest`; set the `SITE_URL` and `CRON_SECRET` repository secrets to enable it.
- If every live source fails, the committed snapshot in `src/data/snapshot.json` keeps the page populated and the header says so. Refresh it with `npm run dev` and then `npm run snapshot`.

## Architecture

```
sources (state + corroborating + GDELT + RSS)
   → classify (keyword rules: category, partner, place, theater, sourcing kind)
   → mergeClusters (same happening → one event, all sources listed, tier set)
   → trip context · diplomatic linkage · partner ranking · status line
   → Analyst Read (rules for all; Gemini polishes the top 6, one call)
   → briefing (Gemini once per ingest, rules fallback)
   → Store  →  dossier · map · timeline   (one array, three views)
```

Every event normalizes to the schema in `src/lib/osiris/types.ts`:

```ts
{ id, date, category, title, summary,
  location: { lat, lng, name },
  source: { name, url, tier: 'state' | 'corroborated' },
  relatedEntities: [], diplomaticLinkage?: string,
  // enrichment: sources[], theaters[], partner, origin, analystRead, firstSeen …
}
```

| Path | Role |
|---|---|
| `src/lib/osiris/sources/` | Source adapters (state, Ahram, GDELT DOC, GDELT Events, RSS) |
| `src/lib/osiris/classify.ts` | Rule-based classifier, run once per item on ingest |
| `src/lib/osiris/gazetteer.ts` | Countries, leaders and places the classifier recognises |
| `src/lib/osiris/corroborate.ts` | De-duplication and the state / corroborated tier |
| `src/lib/osiris/enrich.ts` | Trip context, conflict-to-diplomacy linkage, partner ranking, status |
| `src/lib/osiris/analyst.ts` | Analyst Read (rules + optional Gemini polish with validation) |
| `src/lib/osiris/risk.ts` | Composite risk score with visible components |
| `src/lib/osiris/store.ts` | Ingest orchestration, caching, optional Redis history, snapshot fallback |
| `src/config/positions.ts` | Dated, sourced position records behind every Analyst Read |
| `src/config/related-coverage.ts` | Manual list of L4 articles to surface as related coverage |
| `src/components/` | Dossier, MapLibre map, timeline, glass drawer, Analyst Mode panels |

### API routes

| Route | Serves |
|---|---|
| `/api/events` | Whole store (`?since=` for cheap polling) |
| `/api/ingest`, `/api/ingest/health` | Forced refresh; per-source status of the last ingest |
| `/api/gdelt` | GDELT 2.0 geocoded events in the MENA box |
| `/api/news`, `/api/live-news` | MENA RSS aggregation; regional live broadcasters |
| `/api/country-risk` | Egypt, Libya, Sudan composite risk with breakdown |
| `/api/region-dossier` | Location context for the drawer (Nominatim, Wikipedia, Wikidata) |
| `/api/conflicts`, `/api/frontlines` | Theater summaries with linkage; conflict geometry as GeoJSON |
| `/api/maritime` | Ports, chokepoints, shipping lane, AIS density, maritime items |
| `/api/ai/briefing`, `/api/ai/analyze`, `/api/ai/overview` | Cached briefing, one event's Analyst Read, AI status |

The AI routes only read what the ingest already produced. Gemini is called at most twice per ingest, and never per page view, so the free tier and the 5-requests-per-minute limit are never at risk.

## Editorial features

- **Sourcing indicator.** Every card and drawer shows *State source only* (Presidency, SIS or MENA with no independent match) or *Independently corroborated* (also carried by Ahram Online, an international outlet, or a non-state GDELT match). Items reported by a single independent outlet with no state account say so explicitly. Analyst Mode lists each source, the feed it came from, and flags state-owned outlets.
- **Analyst Read: How this likely fits his pattern.** A labeled inference, always third person, never in quotation marks, always with its basis one click away: the dated, sourced records in `src/config/positions.ts` plus a comparable earlier event from the store. Gemini output is rejected and replaced by the rules text if it contains quotation marks, first-person pronouns, or attributes thoughts or words to him.
- **Diplomatic linkage.** Conflict and maritime items are linked to the nearest tracked Egyptian engagement on the same theater (three weeks before to one week after). When there is none, the item shows Egypt's standing documented position instead, and says which it is.
- **Relationship strength.** Most engaged partners over 90 days, counting in-person visits in either direction, one per partner per day.
- **New since last visit.** The last-seen time is stored in the browser (localStorage); anything added since is badged and can be filtered.
- **Analyst Mode.** Adds the risk breakdown, sourcing integrity panel, full relationship table, corroboration rate and source health. The default view stays clean.

To add related coverage after publishing an article, append an entry to `src/config/related-coverage.ts`:

```ts
{ title: 'Your headline', url: 'https://l4global.com/slug/', date: '2026-09-18', category: 'Geopolitics', match: ['gaza', 'rafah', 'QA'] },
```

## What was stripped from Osiris, and why

Forked from [simplifaisoul/osiris](https://github.com/simplifaisoul/osiris) (MIT). The original license is kept in `LICENSE` and credited in the footer.

| Removed | Why |
|---|---|
| `$OSIRIS` token panel (a DexScreener/Solana chart), crypto price ticker, promotional README badges and keyword-stuffed metadata | Token promotion has no place in a publication's tool |
| Crypto wallet tracing (`/api/chain`, `/api/crypto`, `/api/osint/crypto`) | Out of scope |
| CCTV (`/api/cctv*`, 17k cameras from TfL, WSDOT, Caltrans…) | No MENA coverage |
| OSINT recon toolkit (DNS, WHOIS, Shodan, certs, leaks, sanctions, CVE, port scanner) | Out of scope for a leadership profile |
| Cyber-threat and malware feeds | Out of scope |
| Flights, satellites, space weather, earthquakes, fires, weather, markets, radar, Sentinel, ArcGIS, navigation, supply-chain panels | Unrelated layers |
| Analytics middleware | It posted every visitor's IP address to a hard-coded Umami instance |
| Docker, nginx, deploy scripts, scratch scrapers, the Python engine | Not needed for Vercel |

Kept and adapted: the Next.js + MapLibre foundation (including its MapLibre worker setup), the GDELT 2.0 export reader, the region dossier, the Gemini key-rotation convention, and the endpoint names listed in the brief.

**Where upstream Osiris differed from the brief (and what was done):**

- `/api/gdelt` actually served **GDACS disaster alerts**. Real GDELT lived at `/api/gdelt-events`. The fork serves real GDELT at `/api/gdelt`, and adds the **GDELT DOC 2.0** API for the 90-day Sisi history.
- `/api/frontlines` was **Ukraine-only** (DeepState). No free, keyless frontline source exists for Libya, Gaza or Sudan (ACLED requires registration). The conflict layer therefore shows only documented lines (Sirte–al-Jufra, the Philadelphi corridor), an approximate Gaza outline, key sites and *indicative* theater areas, all labeled as not depicting territorial control.
- `/api/country-risk` used static scores, had **no Egypt entry**, and matched earthquakes to countries by substring. It was rewritten as a transparent composite (structural baseline 55%, GDELT conflict intensity 20%, GDELT tone 15%, neighbour spillover 10%).
- `/api/maritime` vessel positions required an AIS key and a permanent websocket, which serverless cannot hold. The fork opens a short AIS window per ingest when `AIS_API_KEY` is set; ports, chokepoints and the shipping lane work without it.
- `/api/news` scraped Telegram channels; it now aggregates MENA RSS. `/api/live-news` was a global broadcaster list, trimmed to regional English channels.
- The AI routes were POST endpoints that called Gemini per request. They now serve what the ingest produced.

## Egyptian state sources: access findings

SOURCE_FINDINGS_PLACEHOLDER

## Assumptions made

- **Ahram Online counts as corroborating**, as the brief specifies, although Al-Ahram is state-owned. Analyst Mode flags it, and `OSIRIS_STRICT_SOURCING=1` flips it to state.
- **Single-outlet independent reports** keep the `corroborated` tier in the data (the schema is binary) but display as *Independent report (single outlet)* so the tag never overstates corroboration.
- **Categories:** the brief's four colour families (diplomatic, conflict, economic, ceremonial) are extended with `maritime` and `domestic`, so domestic governance items do not masquerade as diplomacy.
- **The Gulf war (from February 2026)** is tracked as a diplomatic thread and feeds the Analyst Read and linkage, alongside the three conflict theaters the brief names.
- **Map layer 1** (Sisi's movements) includes his trips abroad, domestic tours outside Cairo, and meetings held abroad. Calls and domestic meetings appear on the timeline only. The selected event always gets a focus marker on the map, even if its layer is off.
- **Relationship ranking** counts in-person visits only; calls and summit-sideline meetings are shown separately in Analyst Mode.
- **"Next known engagement"** comes from forward-looking headlines ("to visit", "will attend") in the last ten days that have not yet been matched by an arrival.
- **Basemap:** OpenFreeMap's free dark style (no key, commercial use allowed), recoloured to the L4 palette. Override with `NEXT_PUBLIC_MAP_STYLE`.
- **Chart.js** is bundled from npm (`chart.js` 4.5.x, matching the version L4's backtester loads from cdnjs) rather than loaded from a CDN, since this is a Next.js build.
- **No em dashes** in any UI copy, and AI output is post-processed to remove them, per L4 house style.

## Adding the next leader

1. Duplicate `src/config/positions.ts` with that leader's dated, sourced records.
2. Adjust `SISI_RE` and the query strings in `sources/independent.ts` (`SISI_Q`), and point the state adapters at that country's presidency and news agency.
3. Update `THEATER_DEFS` in `geometry.ts` and the `STRUCTURAL` risk entries.
4. Change the hero copy in `components/DossierHero.tsx`.

## License

MIT, inheriting from Osiris (see `LICENSE`). Data belongs to its respective publishers; every item links to its source.
