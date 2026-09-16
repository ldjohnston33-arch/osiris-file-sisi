/**
 * Hero portrait for the dossier header.
 *
 * Resolved from Wikipedia's REST summary API (which points at whatever the
 * current infobox image on Wikimedia Commons is) rather than a hardcoded
 * filename, so a Commons image rename or update doesn't quietly break the
 * page. Falls back to a fixed Commons URL if the lookup fails, and is cached
 * for a week since a leadership portrait doesn't change often — this runs
 * independently of the 30-minute event-store refresh.
 */

import { unstable_cache } from 'next/cache';
import { getJson } from './http';

export interface HeroImage {
  url: string;
  alt: string;
  caption: string;
  sourceUrl: string;
}

const FALLBACK: HeroImage = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Abdel_Fattah_al-Sisi_2019.jpg/800px-Abdel_Fattah_al-Sisi_2019.jpg',
  alt: 'Abdel Fattah el-Sisi, President of Egypt',
  caption: 'Abdel Fattah el-Sisi. Source: Wikimedia Commons.',
  sourceUrl: 'https://commons.wikimedia.org/wiki/Category:Abdel_Fattah_el-Sisi',
};

interface WikiSummary {
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchHeroImage(): Promise<HeroImage> {
  try {
    const data = await getJson<WikiSummary>('https://en.wikipedia.org/api/rest_v1/page/summary/Abdel_Fattah_el-Sisi', { timeoutMs: 10000, browserUa: true });
    const src = data.originalimage?.source || data.thumbnail?.source;
    if (!src) return FALLBACK;
    return {
      url: src,
      alt: 'Abdel Fattah el-Sisi, President of Egypt',
      caption: 'Abdel Fattah el-Sisi. Source: Wikipedia / Wikimedia Commons.',
      sourceUrl: data.content_urls?.desktop?.page || FALLBACK.sourceUrl,
    };
  } catch {
    return FALLBACK;
  }
}

/** Cached for 7 days; independent of the event-store's 30-minute cycle. */
export const getHeroImage = unstable_cache(fetchHeroImage, ['osiris-sisi-hero-image-v1'], { revalidate: 7 * 24 * 60 * 60 });
