/**
 * AI engine — Google Gemini over REST.
 *
 * Adapted from Osiris's ai-engine (which used the @google/generative-ai SDK
 * and a global-threat persona). Kept: the GEMINI_API_KEY_1..8 convention and
 * round-robin key rotation. Changed: plain REST (no SDK), JSON-mode output,
 * model fallback chain, and prompts scoped to the Osiris File.
 *
 * Budget: the ingest makes at most two Gemini calls per refresh (briefing +
 * one batched Analyst Read request). Nothing here runs per page view.
 */

import { postJson } from '@/lib/osiris/http';

export function getEnvApiKeys(): string[] {
  const keys: string[] = [];
  const single = process.env.GEMINI_API_KEY;
  if (single?.trim()) keys.push(single.trim());
  for (let i = 1; i <= 8; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim().length > 0) keys.push(key.trim());
  }
  return [...new Set(keys)];
}

let _keyIndex = 0;
export function rotateApiKey(keys: string[]): string {
  if (keys.length === 0) throw new Error('No API keys available');
  const key = keys[_keyIndex % keys.length];
  _keyIndex = (_keyIndex + 1) % keys.length;
  return key;
}

export const aiEnabled = () => getEnvApiKeys().length > 0;

// 'gemini-flash-latest' and 'gemini-2.5-flash' (the previous chain) both now 404 with
// "no longer available to new users" on a freshly created API key, as of Sept 2026 Google has
// moved new free-tier keys onto the Gemini 3 line. Chain three current stable models so a
// single retirement doesn't take the whole AI layer down silently again; GEMINI_MODEL still
// overrides everything when set.
function modelChain(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  return [...new Set([env, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter((m): m is string => !!m))];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

// Wrong/retired model name → move on to the next model in the chain, no point retrying it.
const MODEL_UNAVAILABLE = /\b404\b|not found|is not supported/i;
// Transient overload/rate-limit → worth one immediate retry, then fall through to the next
// model. Previously any non-404 error (including this) broke out of the loop entirely, so a
// single "high demand" 503 from the first model in the chain killed the whole call even though
// a second model (or the same model a moment later) would likely have succeeded.
const TRANSIENT = /\b503\b|\b429\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** One JSON-mode generation. Returns parsed JSON and the model that answered. */
export async function generateJson<T>(system: string, prompt: string, maxOutputTokens = 2048): Promise<{ data: T; model: string }> {
  const keys = getEnvApiKeys();
  if (!keys.length) throw new Error('GEMINI_API_KEY not configured');
  let lastErr: unknown;
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const key = rotateApiKey(keys);
      try {
        const res = await postJson<GeminiResponse>(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens, responseMimeType: 'application/json' },
          },
          { 'x-goog-api-key': key },
          60000,
        );
        if (res.promptFeedback?.blockReason) throw new Error(`blocked: ${res.promptFeedback.blockReason}`);
        const text = res.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
        const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        return { data: JSON.parse(cleaned) as T, model };
      } catch (e) {
        lastErr = e;
        if (!(e instanceof Error)) break;
        if (MODEL_UNAVAILABLE.test(e.message)) break; // no retry, just move to the next model
        if (TRANSIENT.test(e.message) && attempt === 0) { await sleep(800); continue; } // one quick retry
        if (TRANSIENT.test(e.message)) break; // retry also failed; try the next model
        throw e; // anything else (blocked content, bad request, etc.) isn't worth retrying at all
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * House style: no em dashes in anything L4 publishes. Collapses runs of
 * horizontal whitespace only ([ \t], never newlines) so callers that pass
 * multi-line markdown (headings, paragraph breaks) keep their structure;
 * multiple blank lines are tidied to a single one.
 */
export function houseStyle(s: string): string {
  return s
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Rejects AI text that could read as the president's own words. */
export function readsAsQuote(s: string): boolean {
  if (/[“”"]/.test(s)) return true;
  // First-person voice anywhere is disqualifying for analysis text.
  if (/\b(I|I'm|I’m|I've|me|my|mine|we|we're|our|ours|us)\b/.test(s.replace(/\bUS\b/g, ''))) return true;
  if (/\b(Sisi|el-Sisi|al-Sisi|the president)\s+(thinks|believes|feels|wants|says|said|told)\b/i.test(s)) return true;
  return false;
}
