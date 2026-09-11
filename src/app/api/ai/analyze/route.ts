import { NextResponse } from 'next/server';
import { getStore } from '@/lib/osiris/store';

export const maxDuration = 300;

/** Analyst Read for one event (precomputed on ingest). ?id=<event id> */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const store = await getStore();
  const e = store.events.find(x => x.id === id);
  if (!e) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    id: e.id,
    label: 'Analyst Read: How this likely fits his pattern',
    disclaimer: 'Analytical inference by L4 Global based on the cited public record. Not a statement by or attributed to President el-Sisi.',
    analystRead: e.analystRead ?? null,
  });
}
