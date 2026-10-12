import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import type { CSSProperties } from 'react';
import s from './CurveEditor.module.css';

/** The shaded region under or over a curve, in `color` or the theme's fill when it has none. */
export function CurveFill({ d, color }: { d: string; color?: ColorSource }) {
  const fill = useColorCss()(color);
  return (
    <path
      data-curve-element="fill"
      className={s.fill}
      d={d}
      style={fill ? ({ '--curve-fill': fill } as CSSProperties) : undefined}
    />
  );
}
