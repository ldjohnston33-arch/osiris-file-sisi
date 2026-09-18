import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';
import { aiEnabled } from '@/lib/ai-engine';

export const maxDuration = 300;

/** AI layer status: whether Gemini is configured and how the last ingest used it. */
export async function GET() {
  const store = await getStore();
  const reads = store.events.filter(e => e.analystRead);
  return NextResponse.json({
    enabled: aiEnabled(),
    briefingMethod: store.briefing.method,
    model: store.briefing.model ?? null,
    analystReads: { total: reads.length, gemini: reads.filter(e => e.analystRead!.method === 'gemini').length, rules: reads.filter(e => e.analystRead!.method === 'rules').length },
    budget: 'At most 2 Gemini calls per ingest (briefing + one batched Analyst Read request covering only events not already polished); ingest runs at most every ~2 hours.',
    generatedAt: store.generatedAt,
  });
}
