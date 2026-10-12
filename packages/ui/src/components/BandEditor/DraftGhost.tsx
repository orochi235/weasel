import type { CSSProperties, ReactElement } from 'react';
import s from './BandEditor.module.css';
import { pct } from './track';

/** Where a dragged thing started, in domain units: a line, or a band's span. */
export type DraftGhostAt = { at: number } | { from: number; to: number };

/** The mark left where a drag began while the dragged seam, edge, or band follows the pointer. */
export function DraftGhost({ ghost, toUnit }: { ghost: DraftGhostAt; toUnit(value: number): number }): ReactElement {
  const vars = 'at' in ghost
    ? { '--be-at': pct(toUnit(ghost.at)) }
    : { '--be-from': pct(toUnit(ghost.from)), '--be-to': pct(toUnit(ghost.to)) };
  return (
    <div
      className={'at' in ghost ? s.seamGhost : s.bandGhost}
      data-band-ghost=""
      aria-hidden="true"
      style={vars as Record<string, string> as CSSProperties}
    />
  );
}
