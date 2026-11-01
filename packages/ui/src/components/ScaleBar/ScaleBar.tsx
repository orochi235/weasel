import type { CSSProperties, ReactElement } from 'react';
import { scaleBar, type UnitScope, type UnitValue } from '@weasel-js/quantity';
import s from './ScaleBar.module.css';

/** Props for {@link ScaleBar}. */
export interface ScaleBarProps {
  /** Screen pixels one world unit covers: the view's `scale.x`. */
  zoom: number;
  /** The unit scopes of the frame it measures, outermost first. Pass the
   *  root's alone for the board, or `sceneSharedUnitScopes` of the selection
   *  to read the frame the selection sits in. */
  scopes: readonly UnitScope[];
  /** The longest the bar may be, in screen pixels. Default 140. */
  maxPx?: number;
  /** The lengths it chooses among, in the frame's units. Default: 1, 2 and 5
   *  of every decade of every unit its system carries. */
  lengths?: readonly UnitValue[];
  /** Additional class for the root, to place it. */
  className?: string;
}

const times = (n: number): string => `${Number(n.toPrecision(3))}×`;

/**
 * A scale bar: a rule as long on screen as a round length of the frame it
 * measures, labeled with that length. It reads the frame's unit scopes, so
 * inside a frame drawn at a declared magnification it shows that frame's true
 * lengths and says what size it is drawn at.
 */
export function ScaleBar({ zoom, scopes, maxPx, lengths, className }: ScaleBarProps): ReactElement {
  const bar = scaleBar({ pxPerUnit: zoom, scopes, ...(maxPx === undefined ? {} : { maxPx }), ...(lengths ? { lengths } : {}) });
  const drawn = bar.magnification === 1 ? null : `drawn at ${times(bar.magnification)}`;
  const span = { '--wzl-scale-bar-px': `${bar.px}px` } as CSSProperties;
  return (
    <div className={[s.bar, className].filter(Boolean).join(' ')} role="img" aria-label={`Scale: ${bar.label}${drawn ? `, ${drawn}` : ''}`}>
      <span className={s.rule} style={span} />
      <span className={s.label}>{bar.label}</span>
      {drawn && <span className={s.drawn}>{drawn}</span>}
    </div>
  );
}
