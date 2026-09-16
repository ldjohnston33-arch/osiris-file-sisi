'use client';

import { Fragment } from 'react';

/**
 * Minimal, dependency-free markdown renderer for short AI/rules-generated
 * text (the L4 Briefing). Supports only what that copy actually uses:
 * "## " / "### " headings, **bold**, "- " bullet lines, and blank-line
 * paragraph breaks. Anything else is rendered as plain text, so this is
 * intentionally not a general markdown engine.
 */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return null;

        const headingMatch = lines[0].match(/^(#{2,3})\s+(.*)$/);
        if (headingMatch) {
          const Tag = headingMatch[1].length === 2 ? 'h4' : 'h5';
          const rest = lines.slice(1);
          return (
            <div key={i} className="md-block">
              <Tag className="md-heading">{inline(headingMatch[2])}</Tag>
              {rest.length > 0 && renderLines(rest, i)}
            </div>
          );
        }

        if (lines.every(l => l.startsWith('- '))) {
          return (
            <ul key={i} className="md-list">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }

        return <p key={i} className="md-p">{inline(lines.join(' '))}</p>;
      })}
    </div>
  );
}

function renderLines(lines: string[], keyBase: number) {
  if (lines.every(l => l.startsWith('- '))) {
    return (
      <ul className="md-list">
        {lines.map((l, j) => (
          <li key={`${keyBase}-${j}`}>{inline(l.slice(2))}</li>
        ))}
      </ul>
    );
  }
  return <p className="md-p">{inline(lines.join(' '))}</p>;
}

/** Inline **bold** only; everything else passes through as plain text. */
function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <Fragment key={i}><strong>{p.slice(2, -2)}</strong></Fragment>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}
