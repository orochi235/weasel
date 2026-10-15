import type { CSSProperties } from 'react';
import s from './CurveEditor.module.css';

/** The shaded region under or over a curve, in `fill` or the theme's fill when it has none. */
export function CurveFill({ d, fill }: { d: string; fill?: string | undefined }) {
  return (
    <path
      data-curve-element="fill"
      className={s.fill}
      d={d}
      style={fill ? ({ '--curve-fill': fill } as CSSProperties) : undefined}
    />
  );
}
