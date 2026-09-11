'use client';

import { LAYERS, type LayerId } from '@/lib/osiris/ui';

export default function LayerToggles({ layers, onToggle }: { layers: Set<LayerId>; onToggle: (id: LayerId) => void }) {
  return (
    <div className="chips" role="group" aria-label="Map layers">
      {LAYERS.map(l => (
        <button key={l.id} className="chip" aria-pressed={layers.has(l.id)} onClick={() => onToggle(l.id)} title={l.hint} style={{ ['--chip-color' as string]: l.color }}>
          <span className="pill-dot" aria-hidden />
          {l.label}
        </button>
      ))}
    </div>
  );
}
