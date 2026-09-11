'use client';

import { useEffect, useMemo, useRef } from 'react';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import type { OsirisEvent } from '@/lib/osiris/types';
import { CATEGORY, LANES } from '@/lib/osiris/ui';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const DAY = 86_400_000;
const LANE_COLORS = ['#00aaff', '#8f7bff', '#ff4d5e', '#19d3c5'];

/** Daily activity, stacked by timeline lane. Clicking a bar scrubs the timeline. */
export default function ActivityChart({ events, start, end, onPick }: { events: OsirisEvent[]; start: number; end: number; onPick: (t: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  const data = useMemo(() => {
    const d0 = Math.floor(start / DAY) * DAY;
    const n = Math.max(1, Math.ceil((end - d0) / DAY));
    const labels: string[] = [];
    const days: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = d0 + i * DAY;
      days.push(t);
      labels.push(new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
    }
    const series = LANES.map(() => new Array(n).fill(0));
    for (const e of events) {
      const i = Math.floor((Date.parse(e.date) - d0) / DAY);
      if (i >= 0 && i < n) series[CATEGORY[e.category].lane][i]++;
    }
    return { labels, days, series };
  }, [events, start, end]);

  useEffect(() => {
    if (!canvas.current) return;
    chart.current = new Chart(canvas.current, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(12,20,38,0.95)', borderColor: '#3a4a6a', borderWidth: 1, titleColor: '#f0f4ff', bodyColor: '#9aaac0', padding: 8 },
        },
        scales: {
          x: { stacked: true, display: false, grid: { display: false } },
          y: { stacked: true, display: false, grid: { display: false }, beginAtZero: true },
        },
        onClick: (_e, els, c) => {
          const idx = els[0]?.index;
          const days = (c.data as unknown as { _days?: number[] })._days;
          if (idx !== undefined && days) pick.current(days[idx] + DAY / 2);
        },
      },
    });
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.data.labels = data.labels;
    (c.data as unknown as { _days: number[] })._days = data.days;
    c.data.datasets = LANES.map((l, i) => ({
      label: l,
      data: data.series[i],
      backgroundColor: LANE_COLORS[i] + 'cc',
      hoverBackgroundColor: LANE_COLORS[i],
      borderRadius: 2,
      barPercentage: 0.9,
      categoryPercentage: 0.9,
    }));
    c.update();
  }, [data]);

  return <canvas ref={canvas} aria-label="Daily activity by lane" role="img" />;
}
