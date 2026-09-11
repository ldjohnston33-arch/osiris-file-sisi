import { NextResponse } from 'next/server';

/**
 * Region Dossier API (from Osiris)
 * Location context for a coordinate: reverse geocode (Nominatim), Wikipedia
 * summary, and Wikidata country facts. Used by the Osiris File detail drawer's
 * "About this location" panel, fetched lazily when a user opens an event.
 * Coordinates are rounded to 0.1° so nearby events share one cached answer,
 * which also keeps us well inside Nominatim's 1 request/second policy.
 */

const UA = 'L4Global-OsirisFile/1.0 (+https://l4global.com)';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Math.round(parseFloat(searchParams.get('lat') || 'NaN') * 10) / 10;
  const lng = Math.round(parseFloat(searchParams.get('lng') || 'NaN') * 10) / 10;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng query parameters are required' }, { status: 400 });
  }

  try {
    // Step 1: Reverse geocode to get country (must complete first — other steps depend on it)
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=5&addressdetails=1`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': UA },
        next: { revalidate: 86400 },
      }
    );

    let countryName = '';
    let countryCode = '';
    let locationInfo: Record<string, string> = {};

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const addr = geoData.address || {};
      countryName = addr.country || '';
      countryCode = addr.country_code?.toUpperCase() || '';
      locationInfo = {
        city: addr.city || addr.town || addr.village || '',
        state: addr.state || addr.region || '',
        country: countryName,
        country_code: countryCode,
        display_name: geoData.display_name,
      };
    }

    // Steps 2-3: Run in PARALLEL after geocode
    const [wikiResult, wdResult] = await Promise.allSettled([

      // Step 2: Fetch Wikipedia summary
      (async () => {
        const wikiQuery = locationInfo.city || countryName;
        if (!wikiQuery) return null;
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`,
            { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA }, next: { revalidate: 86400 } }
          );
          if (res.ok) {
            const wiki = await res.json();
            return {
              title: wiki.title,
              extract: wiki.extract?.substring(0, 500),
              thumbnail: wiki.thumbnail?.source,
            };
          }
        } catch (e) { console.warn('[region-dossier] Wikipedia fetch error:', e instanceof Error ? e.message : e); }
        return null;
      })(),

      // Step 3: Fetch all country info & head of state from Wikidata SPARQL
      (async () => {
        if (!countryName) return null;
        try {
          const safe = countryName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const sparql = `
          SELECT ?leaderLabel ?positionLabel ?population ?area ?capitalLabel ?regionLabel ?flagUrl (GROUP_CONCAT(DISTINCT ?langLabel; separator=", ") AS ?languages) (GROUP_CONCAT(DISTINCT ?currLabel; separator=", ") AS ?currencies)
          WHERE { 
            ?country wdt:P31/wdt:P279* wd:Q6256; 
                     rdfs:label "${safe}"@en. 
            OPTIONAL { 
              ?country wdt:P6 ?leader. 
              OPTIONAL { ?leader wdt:P39 ?position. }
            }
            OPTIONAL { ?country wdt:P1082 ?population. } 
            OPTIONAL { ?country wdt:P2046 ?area. } 
            OPTIONAL { ?country wdt:P36 ?capital. } 
            OPTIONAL { ?country wdt:P30 ?region. } 
            OPTIONAL { ?country wdt:P37 ?lang. } 
            OPTIONAL { ?country wdt:P38 ?curr. } 
            OPTIONAL { ?country wdt:P41 ?flagUrl. } 
            SERVICE wikibase:label { 
              bd:serviceParam wikibase:language "en". 
              ?leader rdfs:label ?leaderLabel.
              ?position rdfs:label ?positionLabel.
              ?capital rdfs:label ?capitalLabel. 
              ?region rdfs:label ?regionLabel. 
              ?lang rdfs:label ?langLabel. 
              ?curr rdfs:label ?currLabel. 
            } 
          } 
          GROUP BY ?leaderLabel ?positionLabel ?population ?area ?capitalLabel ?regionLabel ?flagUrl
          LIMIT 1`;
          
          const res = await fetch(
            `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
            {
              signal: AbortSignal.timeout(6000),
              headers: { 'User-Agent': UA, 'Accept': 'application/json' },
              next: { revalidate: 86400 },
            }
          );
          if (res.ok) {
            const wd = await res.json();
            return wd.results?.bindings?.[0] || null;
          }
        } catch (e) { console.warn('[region-dossier] Wikidata fetch error:', e instanceof Error ? e.message : e); }
        return null;
      })(),
    ]);

    const wikiSummary = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
    const wdData      = wdResult.status   === 'fulfilled' ? wdResult.value   : null;

    let countryData = null;
    let headOfState = null;

    if (wdData) {
      headOfState = wdData.leaderLabel ? {
        name: wdData.leaderLabel.value,
        position: wdData.positionLabel?.value || 'Head of State',
      } : null;

      countryData = {
        name: countryName,
        official_name: countryName,
        capital: wdData.capitalLabel?.value,
        population: wdData.population?.value ? parseInt(wdData.population.value, 10) : undefined,
        area: wdData.area?.value ? parseFloat(wdData.area.value) : undefined,
        region: wdData.regionLabel?.value,
        subregion: wdData.regionLabel?.value,
        languages: wdData.languages?.value ? wdData.languages.value.split(', ') : [],
        currencies: wdData.currencies?.value ? wdData.currencies.value.split(', ') : [],
        flag_url: wdData.flagUrl?.value,
        timezones: [],
      };
    }

    return NextResponse.json({
      coordinates: { lat, lng },
      location: locationInfo,
      country: countryData,
      head_of_state: headOfState,
      wikipedia: wikiSummary,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
      },
    });
  } catch (error) {
    console.error('Region dossier error:', error);
    return NextResponse.json({ error: 'Failed to fetch region data' }, { status: 500 });
  }
}
