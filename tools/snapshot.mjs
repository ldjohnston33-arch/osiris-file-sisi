// Writes src/data/snapshot.json from a running instance, so the page still
// renders if every live source is down at build time.
//   npm run dev   (in another terminal)
//   node tools/snapshot.mjs [http://localhost:3000] [CRON_SECRET]
import { writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://localhost:3000';
const secret = process.argv[3] || process.env.CRON_SECRET || '';
const res = await fetch(`${base}/api/ingest?fresh=1`, { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
if (!res.ok) throw new Error(`ingest responded ${res.status}`);
const store = await res.json();
store.mode = 'snapshot';
store.events = store.events.slice(0, 400);
await writeFile(new URL('../src/data/snapshot.json', import.meta.url), JSON.stringify(store));
console.log(`snapshot: ${store.events.length} events from ${store.generatedAt}`);
