'use client';

/*
 * DashboardGrid — a drag-to-move, drag-to-resize CSS grid for the dossier's
 * top-level sections, with the arrangement persisted per-viewer.
 *
 * ── Grid unit system ───────────────────────────────────────────────────
 *   • The container is a 12-column CSS grid (GRID_COLS). Column width is
 *     fluid — each column is an equal fraction of the container's width.
 *   • Rows are quantized to ROW_H (24px) tall, so widgets "snap" to a
 *     24px vertical rhythm while dragging/resizing. GRID_GAP (20px) sits
 *     between both columns and rows, matching this repo's existing
 *     spacing scale (.grid-2's 20px gap, .section's 28px rhythm).
 *   • A widget's layout is { x, y, w, h }, all in grid cells, 1-based:
 *       x = column start (1..12)         w = column span (width in cells)
 *       y = row start (1..∞)             h = row span (height in cells)
 *     A widget occupies grid-column: x / span w and grid-row: y / span h.
 *   • Row tracks are sized with `minmax(ROW_H, auto)`, not a hard ROW_H —
 *     so a widget's *content* is never clipped or overlapped: h mainly
 *     drives the widget's advisory min-height and where its resize handle
 *     starts, while the actual rendered height still grows to fit
 *     whatever the widget renders (event lists, briefings, etc. are
 *     unbounded in length). Width (w) is the dimension resizing actually
 *     changes in a visually obvious way, since these widgets' internal
 *     layouts (tiles, panels) reflow with available width.
 *   • Pixel height for h cells, for reference: h * ROW_H + (h - 1) * GRID_GAP.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import './dashboard-grid.css';

export const GRID_COLS = 12;
export const ROW_H = 24;
export const GRID_GAP = 20;
export const MIN_W = 2;
export const MIN_H = 4;

export interface WidgetPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LayoutMap = Record<string, WidgetPos>;

const LS_LAYOUT = 'osiris-file:sisi:layout:v1';

/**
 * Default layout — every one of the dossier's sections gets its own entry
 * so each is independently draggable/resizable (nothing is grouped into a
 * shared block anymore). Roughly matches the page's original reading order;
 * the viewer's own saved arrangement (LS_LAYOUT) always wins once they've
 * moved anything.
 */
export const DEFAULT_LAYOUT: LayoutMap = {
  photo: { x: 1, y: 1, w: 6, h: 18 },
  identity: { x: 1, y: 19, w: 6, h: 10 },
  briefing: { x: 7, y: 1, w: 6, h: 9 },

  tileThreads: { x: 1, y: 30, w: 2, h: 5 },
  tileRisk: { x: 3, y: 30, w: 2, h: 5 },
  tileTrips: { x: 5, y: 30, w: 2, h: 5 },
  tileVisits: { x: 7, y: 30, w: 2, h: 5 },
  tileLastVisit: { x: 9, y: 30, w: 2, h: 5 },
  tileCorroboration: { x: 11, y: 30, w: 2, h: 5 },

  map: { x: 1, y: 36, w: 12, h: 20 },
  timeline: { x: 1, y: 57, w: 12, h: 10 },
  partners: { x: 1, y: 68, w: 6, h: 10 },
  theaters: { x: 7, y: 68, w: 6, h: 10 },
  events: { x: 1, y: 79, w: 12, h: 14 },

  riskPanel: { x: 1, y: 94, w: 6, h: 10 },
  sourcingPanel: { x: 7, y: 94, w: 6, h: 10 },
  relationshipTable: { x: 1, y: 105, w: 12, h: 10 },
  healthTable: { x: 1, y: 116, w: 12, h: 10 },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

function isWidgetPos(v: unknown): v is WidgetPos {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number' && typeof p.w === 'number' && typeof p.h === 'number';
}

function readLayout(): LayoutMap {
  try {
    const raw = window.localStorage.getItem(LS_LAYOUT);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: LayoutMap = {};
    for (const [id, pos] of Object.entries(parsed as Record<string, unknown>)) {
      if (isWidgetPos(pos)) out[id] = pos;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLayout(layout: LayoutMap) {
  try {
    window.localStorage.setItem(LS_LAYOUT, JSON.stringify(layout));
  } catch {
    /* private mode / blocked storage: feature degrades silently */
  }
}

interface GridContextValue {
  editMode: boolean;
  layout: LayoutMap;
  registerDefault: (id: string, pos: WidgetPos) => void;
  updateWidget: (id: string, pos: WidgetPos) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

const GridContext = createContext<GridContextValue | null>(null);

function useGridContext(where: string): GridContextValue {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error(`${where} must be rendered inside <DashboardGrid>`);
  return ctx;
}

export function DashboardGrid({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  // Start empty on both server and first client render — identical to the
  // server-rendered markup, so there's no hydration mismatch. Each Widget
  // falls back to its own defaultPos whenever layout[id] is unset, so this
  // renders exactly like DEFAULT_LAYOUT until the effect below (client-only)
  // merges in whatever this viewer previously saved.
  const [layout, setLayout] = useState<LayoutMap>({});
  const skipPersist = useRef(true);

  useEffect(() => {
    const stored = readLayout();
    if (Object.keys(stored).length > 0) setLayout(prev => ({ ...prev, ...stored }));
  }, []);

  useEffect(() => {
    // Skip the very first run — it fires as part of the initial mount
    // commit (before any real user action), so there's nothing worth
    // persisting yet and we'd otherwise risk racing the read-back above.
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    writeLayout(layout);
  }, [layout]);

  const registerDefault = useCallback((id: string, pos: WidgetPos) => {
    setLayout(prev => (prev[id] ? prev : { ...prev, [id]: pos }));
  }, []);

  const updateWidget = useCallback((id: string, pos: WidgetPos) => {
    setLayout(prev => ({ ...prev, [id]: pos }));
  }, []);

  const ctx = useMemo<GridContextValue>(
    () => ({ editMode, layout, registerDefault, updateWidget, containerRef }),
    [editMode, layout, registerDefault, updateWidget],
  );

  return (
    <GridContext.Provider value={ctx}>
      <div className="dgrid-toolbar">
        <button
          type="button"
          className={`dgrid-edit-toggle${editMode ? ' is-active' : ''}`}
          aria-pressed={editMode}
          onClick={() => setEditMode(v => !v)}
        >
          <LayoutIcon />
          {editMode ? 'Done arranging' : 'Edit layout'}
        </button>
        {editMode && (
          <span className="dgrid-edit-hint faint">Drag a panel by its handle to move it, or its corner to resize.</span>
        )}
      </div>
      <div ref={containerRef} className={`dgrid${editMode ? ' is-editing' : ''}`}>
        {children}
      </div>
    </GridContext.Provider>
  );
}

export function Widget({
  id,
  title,
  defaultPos,
  children,
}: {
  id: string;
  title: string;
  defaultPos: WidgetPos;
  children: ReactNode;
}) {
  const { editMode, layout, registerDefault, updateWidget, containerRef } = useGridContext('Widget');
  const elRef = useRef<HTMLDivElement>(null);
  const pos = layout[id] ?? defaultPos;

  useEffect(() => {
    registerDefault(id, defaultPos);
    // Only seed once per widget id — defaultPos is expected to be a stable
    // literal from the caller, not something that changes across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, mode: 'move' | 'resize') => {
      if (!editMode) return;
      const container = containerRef.current;
      const el = elRef.current;
      if (!container || !el) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const colPx = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
      if (!(colPx > 0)) return;
      const cellW = colPx + GRID_GAP;
      const cellH = ROW_H + GRID_GAP;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startPos: WidgetPos = { ...pos };
      let latest: WidgetPos = startPos;

      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported: dragging still works via window listeners */
      }
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      el.classList.add('is-dragging');

      const applyStyle = (p: WidgetPos) => {
        el.style.gridColumn = `${p.x} / span ${p.w}`;
        el.style.gridRow = `${p.y} / span ${p.h}`;
        el.style.minHeight = `${p.h * ROW_H + (p.h - 1) * GRID_GAP}px`;
      };

      const onMove = (ev: PointerEvent) => {
        const dxCells = Math.round((ev.clientX - startClientX) / cellW);
        const dyCells = Math.round((ev.clientY - startClientY) / cellH);
        if (mode === 'move') {
          const x = clamp(startPos.x + dxCells, 1, GRID_COLS - startPos.w + 1);
          const y = Math.max(1, startPos.y + dyCells);
          latest = { ...startPos, x, y };
        } else {
          const w = clamp(startPos.w + dxCells, MIN_W, GRID_COLS - startPos.x + 1);
          const h = Math.max(MIN_H, startPos.h + dyCells);
          latest = { ...startPos, w, h };
        }
        applyStyle(latest);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = prevUserSelect;
        el.classList.remove('is-dragging');
        updateWidget(id, latest);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [editMode, pos, containerRef, id, updateWidget],
  );

  const style: CSSProperties = {
    gridColumn: `${pos.x} / span ${pos.w}`,
    gridRow: `${pos.y} / span ${pos.h}`,
    minHeight: pos.h * ROW_H + (pos.h - 1) * GRID_GAP,
  };

  return (
    <div ref={elRef} id={`widget-${id}`} className={`dgrid-widget${editMode ? ' is-editable' : ''}`} style={style}>
      {editMode && (
        <div className="dgrid-widget-head">
          <button
            type="button"
            className="dgrid-drag-handle"
            aria-label={`Drag to move ${title}`}
            onPointerDown={e => handlePointerDown(e, 'move')}
          >
            <GripIcon />
          </button>
          <span className="dgrid-widget-title">{title}</span>
        </div>
      )}
      <div className="dgrid-widget-body">{children}</div>
      {editMode && (
        <button
          type="button"
          className="dgrid-resize-handle"
          aria-label={`Resize ${title}`}
          onPointerDown={e => handlePointerDown(e, 'resize')}
        >
          <ResizeIcon />
        </button>
      )}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {[3, 7, 11].map(cy => (
        <g key={cy}>
          <circle cx="4" cy={cy} r="1.3" fill="currentColor" />
          <circle cx="10" cy={cy} r="1.3" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function ResizeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M11 2 2 11M11 6.5 6.5 11M11 11l0 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 6h12M6 1v12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
