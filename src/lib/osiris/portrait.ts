/**
 * Hero portrait for the dossier header.
 *
 * Pulls the most recently uploaded Wikimedia Commons photo of Sisi rather
 * than a fixed portrait, so the header reads as "the latest publicly
 * available shot of him" and rotates as new event photos land on Commons
 * (typically photos released by a host government's own press office under
 * a free license, or press-pool photos a Commons contributor has uploaded
 * under a compatible one — this project only uses free/CC sources, see the
 * project brief). Filters out flags/logos/maps/graphics and anything
 * without a usable license. Revalidated daily; falls back to a fixed
 * portrait URL if the lookup ever fails or turns up nothing usable.
 */

import { unstable_cache } from 'next/cache';
import { getJson } from './http';

export interface HeroImage {
  url: string;
  alt: string;
  caption: string;
  sourceUrl: string;
}

// Verified live (currently the infobox photo on Wikipedia's Sisi article,
// so it's in active use and very unlikely to be deleted from Commons).
const FALLBACK: HeroImage = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/AbdelFattah_Elsisi_%28cropped%29.jpg',
  alt: 'Abdel Fattah el-Sisi, President of Egypt',
  caption: 'Abdel Fattah el-Sisi. Source: Wikimedia Commons.',
  sourceUrl: 'https://commons.wikimedia.org/wiki/Category:Abdel_Fattah_el-Sisi',
};

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** Filenames that are almost certainly not an event photo. */
const NOT_A_PHOTO = /flag|logo|emblem|coat[_ ]of[_ ]arms|seal[_ .]|map[_ .]|signature|stamp|banknote|coin[_ .]|sticker|icon[_ .]|infobox|graph|chart[_ .]|cartoon|caricature|\.svg$|\.pdf$|\.webm$|\.ogv$|\.gif$/i;

interface SearchHit { title: string; }
interface SearchResp { query?: { search?: SearchHit[] } }
interface ImageInfo {
  url: string;
  width?: number;
  height?: number;
  timestamp?: string;
  user?: string;
  extmetadata?: {
    LicenseShortName?: { value: string };
    Artist?: { value: string };
    Credit?: { value: string };
  };
}
interface Page { title: string; imageinfo?: ImageInfo[] }
interface InfoResp { query?: { pages?: Record<string, Page> } }

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function isUsableLicense(license?: string): boolean {
  if (!license) return false;
  return /cc[- ]?(by|0)|public domain|pd[- ]|cc0/i.test(license);
}

async function fetchHeroImage(): Promise<HeroImage> {
  try {
    // Newest-first full-text search over Commons file pages mentioning him.
    // Two bugs fixed here that silently forced FALLBACK on every single run:
    //  1. srsort must be "create_timestamp_desc" — "create_timestamp_descending"
    //     is rejected outright by the API (400/badvalue), which surfaced as an
    //     empty result set here rather than a thrown error.
    //  2. The search phrase must be quoted, or MediaWiki treats it as an OR of
    //     "Abdel" / "Fattah" / "el-Sisi" and newest-first sorting mostly turns
    //     up unrelated new uploads that just happen to contain one of those
    //     words (e.g. anything mentioning Empress "Sisi" of Austria).
    const srsearch = `"Abdel Fattah el-Sisi"`;
    const searchUrl = `${COMMONS_API}?action=query&list=search&srsearch=${encodeURIComponent(srsearch)}&srnamespace=6&srsort=create_timestamp_desc&srlimit=40&format=json&origin=*`;
    const search = await getJson<SearchResp>(searchUrl, { timeoutMs: 12000, browserUa: true });
    const titles = (search.query?.search ?? []).map(h => h.title).filter(t => !NOT_A_PHOTO.test(t));
    if (!titles.length) return FALLBACK;

    const infoUrl = `${COMMONS_API}?action=query&titles=${encodeURIComponent(titles.slice(0, 20).join('|'))}&prop=imageinfo&iiprop=url|extmetadata|timestamp|user|size&format=json&origin=*`;
    const info = await getJson<InfoResp>(infoUrl, { timeoutMs: 12000, browserUa: true });
    const pages = Object.values(info.query?.pages ?? {});

    // Keep the search's newest-first order; pick the first real, usably-licensed, reasonably large photo.
    const byTitle = new Map(pages.map(p => [p.title, p]));
    for (const title of titles) {
      const page = byTitle.get(title);
      const ii = page?.imageinfo?.[0];
      if (!ii) continue;
      if ((ii.width ?? 0) < 400 || (ii.height ?? 0) < 400) continue;
      const license = ii.extmetadata?.LicenseShortName?.value;
      if (!isUsableLicense(license)) continue;
      const artist = ii.extmetadata?.Artist?.value ? stripHtml(ii.extmetadata.Artist.value) : ii.user || 'Wikimedia Commons contributor';
      return {
        url: ii.url,
        alt: 'Abdel Fattah el-Sisi, President of Egypt, at a recent public event',
        caption: `Abdel Fattah el-Sisi. Photo: ${artist} (${license}), via Wikimedia Commons.`,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      };
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Revalidated daily so the hero photo rotates with new Commons uploads. */
export const getHeroImage = unstable_cache(fetchHeroImage, ['osiris-sisi-hero-image-v3'], { revalidate: 24 * 60 * 60 });
