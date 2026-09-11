/**
 * Documented-position baseline for the "Analyst Read" feature.
 *
 * Each entry is a dated, sourced public record of a position Sisi or the
 * Egyptian presidency took, or a documented action. The `posture` strings are
 * L4 Global's analytical summary of the pattern those records establish. They
 * are rendered as analysis, never as a quotation or as the president's words.
 *
 * Editing guide: add a new record whenever a statement materially updates the
 * pattern on a theme. Keep `label` factual and neutral; keep `posture` in the
 * third person and framed as inference ("Pattern points to…").
 */

import type { Theater } from '@/lib/osiris/types';

export interface PositionRecord {
  id: string;
  theme: Theme;
  label: string;
  date: string;
  sourceName: string;
  sourceUrl: string;
}

export type Theme = 'gaza' | 'libya' | 'sudan' | 'nile' | 'red-sea' | 'gulf' | 'horn' | 'economy' | 'alignment';

export const THEME_POSTURE: Record<Theme, { title: string; posture: string; keywords: string[]; theater?: Theater }> = {
  gaza: {
    title: 'Gaza',
    theater: 'gaza',
    keywords: ['gaza', 'rafah', 'hamas', 'palestin', 'philadelphi', 'west bank', 'ceasefire', 'hostage', 'kerem shalom'],
    posture:
      'Pattern points to Cairo positioning itself as the indispensable mediator while holding a hard line against any transfer of Gazans into Sinai. Expect support for ceasefire mechanics and reconstruction framed around Egypt’s own March 2025 plan, and firm pushback on anything that touches Rafah or the Philadelphi corridor.',
  },
  libya: {
    title: 'Libya',
    theater: 'libya',
    keywords: ['libya', 'tripoli', 'benghazi', 'haftar', 'dbeibah', 'sirte', 'jufra', 'misrata'],
    posture:
      'Pattern points to deterrence by declaration: Cairo treats the Sirte–al-Jufra line as a security boundary and backs eastern-based partners, while keeping channels open to Tripoli. Expect calls for unified institutions and elections, and a sharp reaction to foreign-force movements near the line.',
  },
  sudan: {
    title: 'Sudan',
    theater: 'sudan',
    keywords: ['sudan', 'khartoum', 'rsf', 'rapid support', 'burhan', 'darfur', 'el fasher', 'kordofan', 'port sudan'],
    posture:
      'Pattern points to consistent backing for Sudan’s state institutions and army-led authorities, rejection of parallel RSF structures, and a preference for neighbour-led mediation formats with Cairo at the centre.',
  },
  nile: {
    title: 'Nile / GERD',
    theater: 'nile',
    keywords: ['gerd', 'renaissance dam', 'nile', 'water security', 'ethiopia'],
    posture:
      'Pattern points to framing Nile water as an existential red line, pursued through legal and multilateral channels such as Security Council letters, and through Horn of Africa alignments rather than direct confrontation.',
  },
  'red-sea': {
    title: 'Red Sea / Suez',
    theater: 'red-sea',
    keywords: ['red sea', 'suez canal', 'bab el-mandeb', 'houthi', 'shipping', 'vessel', 'maritime', 'canal revenue'],
    posture:
      'Pattern points to treating Red Sea insecurity as an economic loss first: expect emphasis on Suez Canal revenue, restraint from joining military coalitions, and diplomacy aimed at de-escalation.',
  },
  gulf: {
    title: 'Gulf war / Iran',
    theater: 'gulf',
    keywords: ['iran', 'tehran', 'irgc', 'gulf conflict', 'gulf war', 'hormuz', 'strikes on iran', 'iranian attack'],
    posture:
      'Pattern points to a dual track: public solidarity with Gulf partners and condemnation of attacks on their sovereignty, paired with steady calls for de-escalation and avoidance of direct military involvement.',
  },
  horn: {
    title: 'Horn of Africa',
    theater: 'horn',
    keywords: ['somalia', 'eritrea', 'djibouti', 'horn of africa', 'aussom', 'somaliland'],
    posture:
      'Pattern points to using Somalia and Eritrea ties as leverage in the GERD dispute and as Red Sea security positioning.',
  },
  economy: {
    title: 'Economy / finance',
    keywords: ['imf', 'investment', 'loan', 'debt', 'inflation', 'pound', 'exchange rate', 'bond', 'gdp', 'swap'],
    posture:
      'Pattern points to pairing IMF programme commitments with large Gulf and Chinese capital inflows, and presenting investment deals and megaprojects as evidence of stability.',
  },
  alignment: {
    title: 'Great-power alignment',
    keywords: ['china', 'brics', 'russia', 'united states', 'xi jinping', 'trump', 'putin', 'modi', 'sco'],
    posture:
      'Pattern points to deliberate multi-alignment: deepening China and BRICS ties while preserving the US security relationship, and avoiding choices that force Cairo to pick a side.',
  },
};

export const POSITIONS: PositionRecord[] = [
  {
    id: 'gaza-sinai-2023',
    theme: 'gaza',
    label: 'Rejected the displacement of Gazans into Sinai, calling it a liquidation of the Palestinian cause (joint press conference with Chancellor Scholz, Cairo)',
    date: '2023-10-18',
    sourceName: 'Anadolu Agency',
    sourceUrl: 'https://www.aa.com.tr/en/middle-east/-we-reject-displacing-gazans-to-sinai-liquidation-of-palestinian-issue-egyptian-president/3024720',
  },
  {
    id: 'gaza-plan-2025',
    theme: 'gaza',
    label: 'Egypt’s Gaza early-recovery and reconstruction plan adopted by the extraordinary Arab League summit in Cairo',
    date: '2025-03-04',
    sourceName: 'UN (A/79/820-S/2025/151)',
    sourceUrl: 'https://www.un.org/unispal/document/cairo-statement-and-arab-plan-adopted-at-the-league-of-arab-states-summit-for-early-recovery-reconstruction-and-development-in-gaza-letter-from-bahrain-a-79-820-s-2025-151/',
  },
  {
    id: 'gaza-sharm-2025',
    theme: 'gaza',
    label: 'Co-chaired the Sharm el-Sheikh Peace Summit with President Trump, where the Gaza ceasefire document was signed',
    date: '2025-10-13',
    sourceName: 'Daily News Egypt',
    sourceUrl: 'https://www.dailynewsegypt.com/2025/10/13/sharm-el-sheikh-summit-delivers-trump-al-sisi-oversee-crucial-gaza-accord-as-world-leaders-converge/',
  },
  {
    id: 'libya-redline-2020',
    theme: 'libya',
    label: 'Declared Sirte and al-Jufra a “red line” and said Egypt could intervene directly if it were crossed (remarks at Sidi Barrani air base)',
    date: '2020-06-20',
    sourceName: 'Associated Press via Washington Times',
    sourceUrl: 'https://www.washingtontimes.com/news/2020/jun/20/egyptian-president-says-libyan-city-sirte-a-red-li/',
  },
  {
    id: 'sudan-neighbors-2023',
    theme: 'sudan',
    label: 'Hosted the Sudan Neighbouring States Summit in Cairo; communiqué stressed Sudan’s sovereignty and state institutions and rejected external interference',
    date: '2023-07-13',
    sourceName: 'Anadolu Agency',
    sourceUrl: 'https://www.aa.com.tr/en/politics/sudans-neighbors-agree-in-cairo-summit-on-ministerial-instrument-to-end-conflict/2944868',
  },
  {
    id: 'sudan-parallel-2025',
    theme: 'sudan',
    label: 'Egypt rejected attempts to form a parallel government in Sudan',
    date: '2025-02-25',
    sourceName: 'Middle East Monitor',
    sourceUrl: 'https://www.middleeastmonitor.com/20250225-egypt-rejects-formation-of-any-parallel-government-in-sudan/',
  },
  {
    id: 'sudan-parallel-2026',
    theme: 'sudan',
    label: 'Egypt rejected “parallel entities” in Sudan and called for national unity',
    date: '2026-04-13',
    sourceName: 'Middle East Monitor',
    sourceUrl: 'https://www.middleeastmonitor.com/20260413-egypt-rejects-parallel-entities-in-sudan-calls-for-unity/',
  },
  {
    id: 'nile-drop-2021',
    theme: 'nile',
    label: 'Warned that no one can take a drop of Egypt’s water (remarks at the Suez Canal Authority, Ismailia)',
    date: '2021-03-30',
    sourceName: 'Daily News Egypt',
    sourceUrl: 'https://www.dailynewsegypt.com/2021/03/30/no-one-can-take-single-drop-of-egypts-water-president-al-sisi/',
  },
  {
    id: 'nile-unsc-2025',
    theme: 'nile',
    label: 'Letter to the UN Security Council rejecting Ethiopia’s unilateral operation of the GERD',
    date: '2025-09-09',
    sourceName: 'UN Digital Library',
    sourceUrl: 'https://digitallibrary.un.org/record/4088202?ln=en',
  },
  {
    id: 'redsea-7bn-2024',
    theme: 'red-sea',
    label: 'Said regional instability cost the Suez Canal roughly $7 billion in 2024 revenue',
    date: '2024-12-26',
    sourceName: 'Xinhua',
    sourceUrl: 'https://english.news.cn/africa/20241227/2697698db7984838ac8d362998dd12c5/c.html',
  },
  {
    id: 'gulf-iran-2025',
    theme: 'gulf',
    label: 'Egypt condemned Israel’s strikes on Iran and warned of repercussions for regional security',
    date: '2025-06-13',
    sourceName: 'Daily News Egypt',
    sourceUrl: 'https://www.dailynewsegypt.com/2025/06/13/egypt-condemns-israeli-strikes-on-iran-warns-of-regional-chaos/',
  },
  {
    id: 'gulf-saudi-2026',
    theme: 'gulf',
    label: 'Condemned Iran’s attacks on Saudi Arabia and the region as violations of sovereignty and international law, during a Gulf tour',
    date: '2026-03-22',
    sourceName: 'Jerusalem Post',
    sourceUrl: 'https://www.jpost.com/middle-east/article-890794',
  },
  {
    id: 'horn-somalia-2024',
    theme: 'horn',
    label: 'Signed a military cooperation protocol with Somalia during President Hassan Sheikh Mohamud’s visit to Cairo',
    date: '2024-08-14',
    sourceName: 'The National',
    sourceUrl: 'https://www.thenationalnews.com/news/mena/2024/08/14/egypt-and-somalia-sign-military-co-operation-protocol-in-cairo/',
  },
  {
    id: 'econ-imf-2024',
    theme: 'economy',
    label: 'IMF board approved an augmented Extended Fund Facility for Egypt, lifting it to about $8 billion',
    date: '2024-03-29',
    sourceName: 'IMF',
    sourceUrl: 'https://www.imf.org/en/news/articles/2024/03/29/pr24101-egypt-imf-executive-board-completes-first-second-reviews-eff-approves-augmentation',
  },
  {
    id: 'align-xi-2026',
    theme: 'alignment',
    label: 'Hosted Xi Jinping in Cairo on the first Chinese state visit to Egypt in a decade',
    date: '2026-09-02',
    sourceName: 'Bloomberg',
    sourceUrl: 'https://www.bloomberg.com/news/articles/2026-09-02/china-s-xi-meets-egypt-s-sisi-on-first-state-visit-in-decade',
  },
];

/** Theater → the themes whose pattern is relevant to it. */
export const THEATER_THEMES: Record<Theater, Theme[]> = {
  gaza: ['gaza'],
  libya: ['libya'],
  sudan: ['sudan', 'nile'],
  gulf: ['gulf', 'red-sea'],
  'red-sea': ['red-sea', 'gulf'],
  nile: ['nile', 'horn'],
  horn: ['horn', 'nile'],
};
