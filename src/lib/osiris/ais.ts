/**
 * Optional live vessel snapshot for the Red Sea / Suez layer.
 *
 * Osiris's maritime route kept a permanent AIS websocket in memory, which a
 * serverless deployment cannot hold. Instead, when AIS_API_KEY is set (free
 * key from aisstream.io), each ingest opens the stream for a few seconds,
 * collects position reports inside the Red Sea box, and bins them into a
 * density grid. Without a key the layer shows ports, chokepoints and the
 * shipping lane only.
 */

import type { MaritimeFeature } from './types';

const BOX = [[11.5, 32.0], [31.6, 44.5]]; // [[minLat, minLng], [maxLat, maxLng]]

export async function aisSnapshot(ms = 12000): Promise<{ features: MaritimeFeature[]; vessels: number; note: string }> {
  const key = process.env.AIS_API_KEY?.trim();
  if (!key) return { features: [], vessels: 0, note: 'AIS_API_KEY not set: vessel density disabled' };
  const { default: WebSocket } = await import('ws');
  const seen = new Map<string, { lat: number; lng: number }>();
  await new Promise<void>(resolve => {
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    const done = () => { try { ws.close(); } catch { /* closed */ } resolve(); };
    const timer = setTimeout(done, ms);
    ws.on('open', () => ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [BOX], FilterMessageTypes: ['PositionReport'] })));
    ws.on('message', (buf: Buffer) => {
      try {
        const m = JSON.parse(buf.toString());
        const meta = m.MetaData;
        if (meta?.MMSI && Number.isFinite(meta.latitude) && Number.isFinite(meta.longitude)) {
          seen.set(String(meta.MMSI), { lat: meta.latitude, lng: meta.longitude });
        }
      } catch { /* skip */ }
    });
    ws.on('error', () => { clearTimeout(timer); done(); });
    ws.on('close', () => { clearTimeout(timer); resolve(); });
  });
  // 0.5° density bins.
  const bins = new Map<string, { lat: number; lng: number; n: number }>();
  for (const v of seen.values()) {
    const bl = Math.floor(v.lat * 2) / 2, bg = Math.floor(v.lng * 2) / 2;
    const k = `${bl},${bg}`;
    const b = bins.get(k) ?? { lat: bl + 0.25, lng: bg + 0.25, n: 0 };
    b.n++;
    bins.set(k, b);
  }
  const features: MaritimeFeature[] = [...bins.values()].map((b, i) => ({ id: `ais-${i}`, kind: 'vessel', name: `${b.n} vessel${b.n > 1 ? 's' : ''}`, lat: b.lat, lng: b.lng, note: String(b.n) }));
  return { features, vessels: seen.size, note: `${seen.size} vessels in ${Math.round(ms / 1000)}s AIS window` };
}
