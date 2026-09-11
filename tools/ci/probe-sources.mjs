// CI helper: fetch every candidate source URL the adapters rely on and record
// status, final URL, content type and the first few KB. Lets us confirm which
// state sources expose RSS versus needing HTML parsing. Output: ci/probes/.
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const enc = s => encodeURI(s);
const targets = {
  'presidency-rss-index': 'https://www.presidency.eg/en/rss/',
  'presidency-feed-news-en': enc('https://www.presidency.eg/en/الأخبار-الرئاسية/'),
  'presidency-feed-events-en': enc('https://www.presidency.eg/en/rss-الأحداث/'),
  'presidency-feed-news-ar': enc('https://www.presidency.eg/الأخبار-الرئاسية/'),
  'presidency-feed-events-ar': enc('https://www.presidency.eg/rss-الأحداث/'),
  'presidency-listing-news-en': enc('https://www.presidency.eg/en/قسم-الأخبار/أخبار-رئاسية/'),
  'presidency-home-en': 'https://www.presidency.eg/en/',
  'sis-feed': 'https://sis.gov.eg/en/feed/',
  'sis-feed-www': 'https://www.sis.gov.eg/en/feed/',
  'sis-news-feed': 'https://sis.gov.eg/en/media-center/news/feed/',
  'sis-listing': 'https://sis.gov.eg/en/media-center/news/',
  'sis-wpjson': 'https://sis.gov.eg/wp-json/wp/v2/posts?per_page=5',
  'sis-home': 'https://sis.gov.eg/en/',
  'mena-home-en': 'https://www.mena.org.eg/en',
  'mena-rss-en': 'https://www.mena.org.eg/en/rss',
  'mena-home': 'https://www.mena.org.eg/',
  'ahram-foreign': 'https://english.ahram.org.eg/Category/1/1234/Egypt/Foreign-Affairs.aspx',
  'ahram-politics': 'https://english.ahram.org.eg/Category/1/64/Egypt/Politics-.aspx',
  'ahram-rss': 'https://english.ahram.org.eg/rss.aspx',
  'ahram-rss-ui': 'https://english.ahram.org.eg/UI/Front/Rss.aspx',
  'aljazeera-rss': 'https://www.aljazeera.com/xml/rss/all.xml',
  'bbc-me-rss': 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
  'almonitor-rss': 'https://www.al-monitor.com/rss',
  'mee-rss': 'https://www.middleeasteye.net/rss',
  'national-rss': 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml',
  'arabnews-rss': 'https://www.arabnews.com/cat/1/rss.xml',
  'gdelt-doc': 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22el-Sisi%22%20sourcelang:english&mode=artlist&format=json&maxrecords=5&timespan=3d',
  'gdelt-lastupdate': 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt',
  'openfreemap-dark': 'https://tiles.openfreemap.org/styles/dark',
  'arabnews-rss2': 'https://www.arabnews.com/rss.xml',
  'arabnews-rss3': 'https://www.arabnews.com/taxonomy/term/1/feed',
  'presidency-api-get': 'https://www.presidency.eg/Surface/News/GetAll?culture=en&categoryId=-1&pageNumber=1&pageSize=12',
  'presidency-api-get2': 'https://www.presidency.eg/Surface/News/GetAll?culture=en&category=-1&page=1',
  'gdelt-doc-sis': 'https://api.gdeltproject.org/api/v2/doc/doc?query=domain:sis.gov.eg&mode=artlist&format=json&maxrecords=10&timespan=14d',
  'gdelt-doc-presidency': 'https://api.gdeltproject.org/api/v2/doc/doc?query=domain:presidency.eg&mode=artlist&format=json&maxrecords=10&timespan=30d',
  'gdelt-doc-ahram': 'https://api.gdeltproject.org/api/v2/doc/doc?query=Sisi%20domain:ahram.org.eg&mode=artlist&format=json&maxrecords=10&timespan=14d',
  'crt-sectigo-dv-r36': 'http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt',
};

await mkdir('ci/probes', { recursive: true });
const summary = {};
for (const [name, url] of Object.entries(targets)) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    summary[name] = { url, status: res.status, finalUrl: res.url, type: res.headers.get('content-type'), bytes: body.length, ms: Date.now() - t0, looksLikeFeed: /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 3000)) };
    await writeFile(`ci/probes/${name}.txt`, `${res.status} ${res.url}\n${res.headers.get('content-type')}\n\n${body.slice(0, 400000)}`);
  } catch (e) {
    summary[name] = { url, error: `${e.message}${e.cause ? ` | cause: ${e.cause.code || e.cause.message}` : ''}`, ms: Date.now() - t0 };
  }
  // GDELT DOC asks for 5 s between calls.
  if (name.startsWith('gdelt')) await new Promise(r => setTimeout(r, 9000));
}
// Presidency news API: try POST variants the listing page's script may use.
for (const [name, body] of [
  ['presidency-api-post-form', 'culture=en&categoryId=-1&pageNumber=1&fromDate=&toDate='],
  ['presidency-api-post-json', JSON.stringify({ culture: 'en', categoryId: -1, pageNumber: 1, fromDate: '', toDate: '' })],
]) {
  try {
    const res = await fetch('https://www.presidency.eg/Surface/News/GetAll', {
      method: 'POST', body, signal: AbortSignal.timeout(25000),
      headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': name.endsWith('json') ? 'application/json' : 'application/x-www-form-urlencoded', Referer: 'https://www.presidency.eg/en/' },
    });
    const text = await res.text();
    summary[name] = { status: res.status, type: res.headers.get('content-type'), bytes: text.length };
    await writeFile(`ci/probes/${name}.txt`, `${res.status}\n${res.headers.get('content-type')}\n\n${text.slice(0, 200000)}`);
  } catch (e) {
    summary[name] = { error: String(e.message) };
  }
}
// Script files referenced by the presidency listing page (to learn the API contract).
try {
  const html = await (await fetch(targets['presidency-listing-news-en'], { headers: { 'User-Agent': UA } })).text();
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], 'https://www.presidency.eg/').toString()).filter(u => u.includes('presidency.eg'));
  await writeFile('ci/probes/presidency-scripts.txt', scripts.join('\n'));
  for (const [i, u] of scripts.entries()) {
    const t = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
    if (/GetAll|apiUrl/.test(t)) await writeFile(`ci/probes/presidency-script-${i}.js`, `// ${u}\n${t.slice(0, 300000)}`);
  }
} catch (e) {
  summary['presidency-scripts'] = { error: String(e.message) };
}
await writeFile('ci/probes/_summary.json', JSON.stringify(summary, null, 2));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(28), v.status ?? 'ERR', v.looksLikeFeed ? 'FEED' : '', v.error ?? v.type ?? '');
