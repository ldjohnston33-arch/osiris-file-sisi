/**
 * Related L4 coverage — manually maintained.
 *
 * When a tracked event's title/summary/entities match any `match` term, the
 * detail drawer surfaces the article as related coverage. Add a line each time
 * you publish something on l4global.com. Terms are case-insensitive and match
 * whole words; ISO-2 country codes (e.g. 'CN') match the event's entities.
 */

export interface CoverageEntry {
  title: string;
  url: string;
  date: string;
  category: 'Macro' | 'Venture' | 'Geopolitics' | 'In Brief';
  match: string[];
}

export const RELATED_COVERAGE: CoverageEntry[] = [
  {
    title: 'Xi Comes to Cairo: What’s in it for Egypt?',
    url: 'https://l4global.com/940-2/',
    date: '2026-09-04',
    category: 'Geopolitics',
    match: ['CN', 'xi jinping', 'suez canal economic zone', 'belt and road', 'debt swap'],
  },
  {
    title: 'Drone Strike at Damietta: Egypt’s Fence-Sitting Just Got More Expensive',
    url: 'https://l4global.com/drone-strike-at-damietta-egypts-fence-sitting-just-got-more-expensive/',
    date: '2026-07-31',
    category: 'Geopolitics',
    match: ['damietta', 'idku', 'lng', 'energos', 'drone strike', 'IR'],
  },
  {
    title: 'Egypt Outperforms: Insulated from the Gulf Conflict, For Now',
    url: 'https://l4global.com/egypt-outperforms-insulated-from-the-gulf-conflict-for-now/',
    date: '2026-07-24',
    category: 'Macro',
    match: ['gulf conflict', 'gulf war', 'egyptian pound', 'inflation', 'IMF', 'bond'],
  },
  {
    title: 'Gulf Sovereign Funds Posted Their Biggest First Half Ever — The Rest of the World Deployed Faster',
    url: 'https://l4global.com/gulf-sovereign-funds-posted-their-biggest-first-half-ever-but-the-rest-of-the-world-deployed-faster/',
    date: '2026-07-17',
    category: 'Macro',
    match: ['sovereign fund', 'pif', 'adq', 'mubadala', 'qia', 'ras el-hekma', 'gulf investment'],
  },
  {
    title: 'GeoGraph: A Beta Model for Predicting Geopolitical Events and Market Reactions',
    url: 'https://l4global.com/geograph-a-beta-model-for-predicting-geopolitical-events-and-market-reactions/',
    date: '2026-08-21',
    category: 'Geopolitics',
    match: ['geograph'],
  },
];
