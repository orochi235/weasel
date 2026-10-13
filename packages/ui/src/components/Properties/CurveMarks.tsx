import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import s from './CurveField.module.css';

/** An annotation drawn over a curve plot: a shaded band across a range of x,
 *  or a vertical line at one x. */
export type CurveMark =
  | { kind: 'band'; x: [number, number]; color?: ColorSource }
  | { kind: 'line'; x: number; color?: ColorSource };

/** The marks of a `<CurveField>`, laid over its plot. */
export function CurveMarks({ marks, width, height }: { marks: readonly CurveMark[]; width: number; height: number }) {
  const css = useColorCss();
  return (
    <svg
      className={s.marks}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {marks.map((m) => {
        const color = css(m.color) ?? '#ffcc00';
        if (m.kind === 'band') {
          const x0 = Math.max(0, Math.min(1, m.x[0])) * width;
          const x1 = Math.max(0, Math.min(1, m.x[1])) * width;
          const left = Math.min(x0, x1);
          const w = Math.abs(x1 - x0);
          return (
            <g key={`band-${m.x[0]}-${m.x[1]}-${color}`}>
              <rect x={left} y={0} width={w} height={height} fill={color} fillOpacity={0.4} />
              <line
                x1={left}
                y1={0}
                x2={left}
                y2={height}
                stroke={color}
                strokeOpacity={0.85}
                strokeWidth={1}
              />
              <line
                x1={left + w}
                y1={0}
                x2={left + w}
                y2={height}
                stroke={color}
                strokeOpacity={0.85}
                strokeWidth={1}
              />
            </g>
          );
        }
        const x = Math.max(0, Math.min(1, m.x)) * width;
        return (
          <line
            key={`mark-${m.x}-${color}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={color}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
