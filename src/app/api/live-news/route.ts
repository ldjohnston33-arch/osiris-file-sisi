import { NextResponse } from 'next/server';

/**
 * Live broadcast channels relevant to Egypt and the region (trimmed from
 * Osiris's global list). embed_allowed marks channels whose YouTube live
 * stream can be iframed; the rest open externally.
 */
const LIVE_FEEDS = [
  { id: 'aljazeera', name: 'Al Jazeera English', city: 'Doha', country: 'QA', url: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1', embed_allowed: true, language: 'en' },
  { id: 'france24en', name: 'France 24 English', city: 'Paris', country: 'FR', url: 'https://www.youtube.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&mute=1', embed_allowed: true, language: 'en' },
  { id: 'dwnews', name: 'DW News', city: 'Berlin', country: 'DE', url: 'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1', embed_allowed: true, language: 'en' },
  { id: 'skynews', name: 'Sky News', city: 'London', country: 'GB', url: 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ&autoplay=1&mute=1', embed_allowed: true, language: 'en' },
];

export async function GET() {
  return NextResponse.json({ feeds: LIVE_FEEDS, total: LIVE_FEEDS.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } });
}
