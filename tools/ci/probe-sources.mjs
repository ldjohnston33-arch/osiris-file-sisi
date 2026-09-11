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
};

await mkdir('ci/probes', { recursive: true });
const summary = {};
for (const [name, url] of Object.entries(targets)) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    summary[name] = { url, status: res.status, finalUrl: res.url, type: res.headers.get('content-type'), bytes: body.length, ms: Date.now() - t0, looksLikeFeed: /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 3000)) };
    await writeFile(`ci/probes/${name}.txt`, `${res.status} ${res.url}\n${res.headers.get('content-type')}\n\n${body.slice(0, 60000)}`);
  } catch (e) {
    summary[name] = { url, error: `${e.message}${e.cause ? ` | cause: ${e.cause.code || e.cause.message}` : ''}`, ms: Date.now() - t0 };
  }
  // GDELT DOC asks for 5 s between calls.
  if (name.startsWith('gdelt')) await new Promise(r => setTimeout(r, 5500));
}
await writeFile('ci/probes/_summary.json', JSON.stringify(summary, null, 2));
for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(28), v.status ?? 'ERR', v.looksLikeFeed ? 'FEED' : '', v.error ?? v.type ?? '');
