import type { Store } from '@/lib/osiris/types';

export default function Footer({ store }: { store: Store }) {
  return (
    <footer className="footer">
      <div className="wrap">
        {store.mode !== 'live' && (
          <div className="notice" style={{ marginBottom: 20 }}>
            {store.mode === 'snapshot' ? 'Live sources were unreachable at the last refresh; showing the last committed snapshot.' : 'Some live sources were unreachable at the last refresh; snapshot data fills the gaps.'}
          </div>
        )}
        <div className="footer-grid">
          <div>
            <h5>Method</h5>
            <p>Osiris File tracks public activity from Egyptian state bulletins (Presidency, SIS, MENA), Ahram Online, international wires via GDELT, and regional RSS. Items describing the same happening are merged, and every item carries a sourcing tag: <b>state source only</b> or <b>independently corroborated</b>. Classification uses transparent keyword rules; the data refreshes about every 30 minutes.</p>
            <p><b>Analyst Read</b> notes are L4 Global’s analytical inferences, grounded in dated and sourced public records. They are never quotations and never represent President el-Sisi’s own words.</p>
          </div>
          <div>
            <h5>Sources</h5>
            <p>presidency.eg · sis.gov.eg · mena.org.eg · english.ahram.org.eg · GDELT Project (DOC 2.0 and Events 2.0) · Al Jazeera · BBC · Al-Monitor · Middle East Eye · The National · Arab News · OpenStreetMap / Wikipedia / Wikidata (location context). Basemap © OpenFreeMap, OpenMapTiles, OpenStreetMap contributors.</p>
            <p>Theater areas on the map are indicative and do not depict territorial control.</p>
          </div>
          <div>
            <h5>L4 Global</h5>
            <p>By Lewis “DJ” Johnston IV, MBA. Macro, geopolitical and venture intelligence on the Middle East and North Africa. <a href="https://l4global.com">l4global.com</a></p>
            <p>Built on <a href="https://github.com/simplifaisoul/osiris">Osiris</a> by simplifaisoul, used under the MIT License.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
