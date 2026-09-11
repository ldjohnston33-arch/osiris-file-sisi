import { getStore } from '@/lib/osiris/store';
import OsirisFile from '@/components/OsirisFile';
import { RELATED_COVERAGE } from '@/config/related-coverage';

// The page is regenerated in the background at most every 15 minutes; the
// store underneath refreshes every 30 minutes. Page views never trigger an
// upstream fetch on their own.
export const revalidate = 900;
export const maxDuration = 300;

export default async function Page() {
  const store = await getStore();
  return <OsirisFile initial={store} coverage={RELATED_COVERAGE} />;
}
