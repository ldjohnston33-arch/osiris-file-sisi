'use client';

import { useEffect, useMemo, useRef } from 'react';
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import type { Store } from '@/lib/osiris/types';
import { fmtDateTime, fmtShort, hostOf } from '@/lib/osiris/ui';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const COMPONENT_COLORS: Record<string, string> = { structural: '#3a4a6a', conflict: '#ff4d5e', tone: '#f5b942', spillover: '#8f7bff' };
const STATE_AFFILIATED = ['ahram.org.eg', 'akhbarelyom.com', 'egypttoday.com', 'alqaheranews.net', 'extranews.tv', 'sada-elbalad.com'];

export default function AnalystPanels({ store }: { store: Store }) {
  return (
    <>
      <div className="section grid-2">
        <RiskPanel store={store} />
        <SourcingPanel store={store} />
      </div>
      <RelationshipTable store={store} />
      <HealthTable store={store} />
    </>
  );
}

function RiskPanel({ store }: { store: Store }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const keys = store.risk[0]?.components.map(c => c.key) ?? [];
    const chart = new Chart(canvas.current, {
      type: 'bar',
      data: {
        labels: store.risk.map(r => `${r.name} ${r.score}`),
        datasets: keys.map(k => ({
          label: store.risk[0].components.find(c => c.key === k)!.label,
          data: store.risk.map(r => {
            const c = r.components.find(x => x.key === k)!;
            return Math.round(c.value * c.weight * 10) / 10;
          }),
          backgroundColor: COMPONENT_COLORS[k] ?? '#00aaff',
          borderRadius: 3,
        })),
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9aaac0', boxWidth: 10, font: { size: 11 } } },
          tooltip: { backgroundColor: 'rgba(12,20,38,0.95)', borderColor: '#3a4a6a', borderWidth: 1, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x} pts` } },
        },
        scales: {
          x: { stacked: true, max: 100, grid: { color: 'rgba(58,74,106,0.25)' }, ticks: { color: '#7a8baa' } },
          y: { stacked: true, grid: { display: false }, ticks: { color: '#f0f4ff', font: { weight: 600 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [store.risk]);
  const eg = store.risk.find(r => r.code === 'EG');
  return (
    <section className="card card-pad" aria-label="Risk breakdown">
      <div className="card-head">
        <div>
          <div className="eyebrow">Analyst Mode</div>
          <h2 className="card-title">Risk score breakdown</h2>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>Points contributed per component</span>
      </div>
      <div style={{ height: 170 }}>
        <canvas ref={canvas} role="img" aria-label="Risk components by country" />
      </div>
      {eg && (
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table className="data">
            <thead><tr><th>Egypt component</th><th>Value</th><th>Weight</th><th>Basis</th></tr></thead>
            <tbody>
              {eg.components.map(c => (
                <tr key={c.key}><td>{c.label}</td><td className="num">{c.value}</td><td className="num">{Math.round(c.weight * 100)}%</td><td className="muted" style={{ fontSize: 12 }}>{c.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {eg?.context && (
        <p className="faint" style={{ fontSize: 12, margin: '10px 0 0', lineHeight: 1.5 }}>
          Against a static 20-country comparison set (mean {eg.context.mean}, median {eg.context.median}, IQR {eg.context.q1}–{eg.context.q3}, range {eg.context.min}–{eg.context.max}), Egypt&rsquo;s composite of {eg.score} sits at the {eg.context.percentile}th percentile
          {eg.score <= eg.context.q1 ? ' — below the lower quartile, calmer than most of the set.' : eg.score >= eg.context.q3 ? ' — above the upper quartile.' : ' — inside the interquartile range.'}
        </p>
      )}
      <p className="faint" style={{ fontSize: 11.5, margin: '6px 0 0' }}>Experimental L4 composite. Structural baselines are editorial and documented in src/lib/osiris/risk.ts; live components come from GDELT.</p>
    </section>
  );
}

function SourcingPanel({ store }: { store: Store }) {
  const s = useMemo(() => {
    const ev = store.events;
    const sisi = ev.filter(e => e.involvesSisi);
    const stateOnly = sisi.filter(e => e.source.tier === 'state');
    const outlets = new Map<string, number>();
    for (const e of ev) for (const src of e.sources) outlets.set(src.name, (outlets.get(src.name) ?? 0) + 1);
    const affiliated = ev.filter(e => e.sources.some(src => STATE_AFFILIATED.some(d => hostOf(src.url).endsWith(d)))).length;
    return {
      total: ev.length,
      sisi: sisi.length,
      stateOnly: stateOnly.length,
      corroborated: sisi.length - stateOnly.length,
      latestStateOnly: stateOnly.slice(0, 6),
      outlets: [...outlets].sort((a, b) => b[1] - a[1]).slice(0, 10),
      affiliated,
    };
  }, [store.events]);
  const pct = s.sisi ? Math.round((s.corroborated / s.sisi) * 100) : 0;
  return (
    <section className="card card-pad" aria-label="Sourcing detail">
      <div className="card-head">
        <div>
          <div className="eyebrow">Analyst Mode</div>
          <h2 className="card-title">Sourcing integrity</h2>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12 }}>
        <div><div className="tile-v" style={{ fontSize: 28 }}>{pct}<small>%</small></div><div className="faint" style={{ fontSize: 12 }}>of Sisi items corroborated</div></div>
        <div><div className="tile-v" style={{ fontSize: 28 }}>{s.stateOnly}</div><div className="faint" style={{ fontSize: 12 }}>state source only</div></div>
        <div><div className="tile-v" style={{ fontSize: 28 }}>{s.affiliated}</div><div className="faint" style={{ fontSize: 12 }}>items citing state-owned outlets</div></div>
      </div>
      <div className="block-k">Latest state-only items</div>
      <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13 }} className="muted">
        {s.latestStateOnly.map(e => <li key={e.id}>{fmtShort(e.date)} · {e.title}</li>)}
        {s.latestStateOnly.length === 0 && <li>None</li>}
      </ul>
      <div className="block-k">Most-cited outlets</div>
      <div className="chips">
        {s.outlets.map(([name, n]) => <span key={name} className="pill">{name} <span className="faint">{n}</span></span>)}
      </div>
      <p className="faint" style={{ fontSize: 11.5, margin: '12px 0 0' }}>
        State = Presidency, SIS, MENA. Ahram Online counts as corroborating per the editorial brief even though Al-Ahram is state-owned; set OSIRIS_STRICT_SOURCING=1 to count state-owned outlets as state.
      </p>
    </section>
  );
}

function RelationshipTable({ store }: { store: Store }) {
  return (
    <section className="section card card-pad" aria-label="Relationship table">
      <div className="card-head">
        <div>
          <div className="eyebrow">Analyst Mode</div>
          <h2 className="card-title">All partners, last 90 days</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th>Partner</th><th>Sisi visited</th><th>Visited Cairo</th><th>Calls / other contacts</th><th>Last contact</th><th>Last Cairo visit</th></tr></thead>
          <tbody>
            {store.partners.map(p => (
              <tr key={p.code}>
                <td><span className="cc">{p.code}</span> {p.name}</td>
                <td className="num">{p.visitsOut}</td>
                <td className="num">{p.visitsIn}</td>
                <td className="num">{p.contacts}</td>
                <td>{fmtShort(p.lastContact)}</td>
                <td>{p.lastInboundVisit ? fmtShort(p.lastInboundVisit) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HealthTable({ store }: { store: Store }) {
  return (
    <section className="section card card-pad" aria-label="Source health">
      <div className="card-head">
        <div>
          <div className="eyebrow">Analyst Mode</div>
          <h2 className="card-title">Source health, last ingest</h2>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{fmtDateTime(store.generatedAt)} · <a href="/api/ingest/health" target="_blank">JSON</a></span>
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th>Source</th><th>Status</th><th>Items</th><th>Time</th><th>Access method / notes</th></tr></thead>
          <tbody>
            {store.health.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 600 }}>{h.name}</td>
                <td className={h.ok ? 'health-ok' : 'health-bad'}>{h.ok ? 'OK' : 'No data'}</td>
                <td className="num">{h.items}</td>
                <td className="num">{h.ms ? `${(h.ms / 1000).toFixed(1)}s` : '–'}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 520 }}>{[h.note, h.error].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
