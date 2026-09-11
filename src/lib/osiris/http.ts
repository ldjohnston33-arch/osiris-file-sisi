/**
 * Shared HTTP client for ingest.
 *
 * Built on node:https rather than fetch for three reasons inherited from the
 * Osiris codebase and the sources this tool reads:
 *   1. IPv4 pinning — GDELT advertises AAAA first; hosts without IPv6 egress
 *      stall on undici's fetch until connect timeout.
 *   2. Incomplete certificate chains — sis.gov.eg serves its leaf without the
 *      Sectigo intermediate. Browsers repair that by downloading the issuer
 *      from the certificate's Authority Information Access URL; so does this
 *      client (see completeChain), caching the result per host.
 *   3. Explicit proxy support — honours HTTPS_PROXY via CONNECT tunnelling so
 *      the ingest can run behind corporate or sandbox proxies. On Vercel no
 *      proxy is set and requests go direct.
 */

import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import zlib from 'node:zlib';
import { X509Certificate } from 'node:crypto';
import type { Socket } from 'node:net';

export const UA = 'L4Global-OsirisFile/1.0 (+https://l4global.com)';
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

export interface GetOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Extra PEM certificates appended to Node's root store for this request. */
  extraCa?: string[];
  maxRedirects?: number;
  /** Use a browser User-Agent (some government CMSes 403 unknown agents). */
  browserUa?: boolean;
}

export interface GetResult {
  status: number;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function proxyFor(target: URL): URL | null {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return null;
  const noProxy = (process.env.NO_PROXY || process.env.no_proxy || '').split(',').map(s => s.trim()).filter(Boolean);
  const host = target.hostname;
  if (noProxy.some(np => np === '*' || host === np || host.endsWith(np.startsWith('.') ? np : '.' + np))) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function tunnel(proxy: URL, host: string, port: number, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.hostname,
      port: Number(proxy.port) || 80,
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers: { Host: `${host}:${port}` },
      timeout: timeoutMs,
    });
    req.once('connect', (res, socket) => {
      if (res.statusCode === 200) resolve(socket);
      else {
        socket.destroy();
        reject(new Error(`proxy CONNECT ${host} -> ${res.statusCode}`));
      }
    });
    req.once('timeout', () => req.destroy(new Error(`proxy CONNECT ${host} timed out`)));
    req.once('error', reject);
    req.end();
  });
}

async function once(url: URL, opts: Required<Pick<GetOptions, 'timeoutMs'>> & GetOptions): Promise<GetResult> {
  const isHttps = url.protocol === 'https:';
  const port = Number(url.port) || (isHttps ? 443 : 80);
  const headers: Record<string, string> = {
    'User-Agent': opts.browserUa ? BROWSER_UA : UA,
    'Accept-Encoding': 'gzip, deflate, br',
    Accept: '*/*',
    ...opts.headers,
  };
  const proxy = proxyFor(url);
  const ca = opts.extraCa?.length ? [...tls.rootCertificates, ...opts.extraCa] : undefined;

  let socket: Socket | undefined;
  if (proxy) socket = await tunnel(proxy, url.hostname, port, opts.timeoutMs);

  return new Promise((resolve, reject) => {
    const reqOpts: https.RequestOptions = {
      host: url.hostname,
      port,
      path: url.pathname + url.search,
      method: 'GET',
      headers,
      timeout: opts.timeoutMs,
      family: proxy ? undefined : 4,
      servername: url.hostname,
      ...(ca ? { ca } : {}),
    };
    if (socket) {
      // Hand the already-open tunnel to the TLS layer.
      if (isHttps) {
        reqOpts.createConnection = () => tls.connect({ socket, servername: url.hostname, ...(ca ? { ca } : {}) });
      } else {
        reqOpts.createConnection = () => socket!;
      }
    }
    const req = (isHttps ? https : http).request(reqOpts, res => {
      const chunks: Buffer[] = [];
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const stream =
        enc === 'gzip' ? res.pipe(zlib.createGunzip()) :
        enc === 'deflate' ? res.pipe(zlib.createInflate()) :
        enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve({ status: res.statusCode ?? 0, url: url.toString(), headers: res.headers, body: Buffer.concat(chunks) }));
      stream.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`${url.hostname} timed out after ${opts.timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

/* ── AIA chasing for servers that omit their intermediate certificate ── */

const chainCache = new Map<string, string[]>();
const CHAIN_ERRORS = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_GET_ISSUER_CERT']);

function caIssuerUrls(infoAccess: string | Record<string, string[]> | undefined): string[] {
  if (!infoAccess) return [];
  if (typeof infoAccess === 'string') {
    return [...infoAccess.matchAll(/CA Issuers - URI:(\S+)/g)].map(m => m[1]);
  }
  return infoAccess['CA Issuers - URI'] ?? [];
}

/** Reads the server's leaf certificate (handshake only, nothing is sent). */
async function peekLeaf(host: string, port: number, timeoutMs: number): Promise<tls.DetailedPeerCertificate> {
  const url = new URL(`https://${host}:${port}/`);
  const proxy = proxyFor(url);
  const socket = proxy ? await tunnel(proxy, host, port, timeoutMs) : undefined;
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host, rejectUnauthorized: false, ...(socket ? { socket } : {}) }, () => {
      const cert = s.getPeerCertificate(true);
      s.end();
      resolve(cert);
    });
    s.setTimeout(timeoutMs, () => s.destroy(new Error(`${host} TLS peek timed out`)));
    s.on('error', reject);
  });
}

/**
 * Downloads missing intermediates via AIA. Only certificates that are not
 * self-signed are accepted, and each must be the issuer of the one before
 * it, so this can repair a chain but never introduce a new trust anchor.
 */
async function completeChain(host: string, port: number, timeoutMs: number): Promise<string[]> {
  const cached = chainCache.get(host);
  if (cached) return cached;
  const leaf = await peekLeaf(host, port, timeoutMs);
  const pems: string[] = [];
  let urls = caIssuerUrls(leaf.infoAccess as unknown as Record<string, string[]>);
  const cn = (dn: string) => dn.match(/CN=([^\n]+)/)?.[1]?.trim() ?? '';
  let expectedCn = String(leaf.issuer?.CN ?? '');
  for (let depth = 0; depth < 3 && urls.length; depth++) {
    const res = await httpGet(urls[0], { timeoutMs, maxRedirects: 3 });
    if (res.status !== 200) break;
    const cert = new X509Certificate(res.body);
    if (cert.subject === cert.issuer) break; // a root: never add as an anchor
    if (expectedCn && cn(cert.subject) !== expectedCn) break;
    pems.push(cert.toString());
    expectedCn = cn(cert.issuer);
    urls = caIssuerUrls(cert.infoAccess);
  }
  chainCache.set(host, pems);
  return pems;
}

export async function httpGet(rawUrl: string, opts: GetOptions = {}): Promise<GetResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  let url = new URL(rawUrl);
  for (let i = 0; i <= (opts.maxRedirects ?? 5); i++) {
    let res: GetResult;
    try {
      const extra = chainCache.get(url.hostname);
      res = await once(url, { ...opts, timeoutMs, extraCa: [...(opts.extraCa ?? []), ...(extra ?? [])] });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (url.protocol !== 'https:' || !code || !CHAIN_ERRORS.has(code) || chainCache.has(url.hostname)) throw e;
      const pems = await completeChain(url.hostname, Number(url.port) || 443, timeoutMs);
      if (!pems.length) throw e;
      res = await once(url, { ...opts, timeoutMs, extraCa: [...(opts.extraCa ?? []), ...pems] });
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = new URL(res.headers.location, url);
      continue;
    }
    return res;
  }
  throw new Error(`${rawUrl}: too many redirects`);
}

export async function getText(url: string, opts: GetOptions = {}): Promise<string> {
  const res = await httpGet(url, opts);
  if (res.status !== 200) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.body.toString('utf8');
}

export async function getJson<T = unknown>(url: string, opts: GetOptions = {}): Promise<T> {
  const text = await getText(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${new URL(url).hostname}: non-JSON response (${text.slice(0, 80).replace(/\s+/g, ' ')})`);
  }
}

export async function getBuffer(url: string, opts: GetOptions = {}): Promise<Buffer> {
  const res = await httpGet(url, opts);
  if (res.status !== 200) throw new Error(`${url} responded ${res.status}`);
  return res.body;
}

/** POST JSON (used for Gemini and the optional Upstash store). Uses fetch:
 *  both are well-behaved HTTPS APIs and fetch keeps the code short. */
export async function postJson<T = unknown>(url: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 45000): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Runs `fn` over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
