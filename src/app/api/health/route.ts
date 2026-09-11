import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    tool: 'Osiris File: Sisi',
    publisher: 'L4 Global',
    endpoints: ['/api/events', '/api/ingest', '/api/ingest/health', '/api/gdelt', '/api/news', '/api/live-news', '/api/country-risk', '/api/region-dossier', '/api/conflicts', '/api/frontlines', '/api/maritime', '/api/ai/briefing', '/api/ai/overview', '/api/ai/analyze'],
    timestamp: new Date().toISOString(),
  });
}
