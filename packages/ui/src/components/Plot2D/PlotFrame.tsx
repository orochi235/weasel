import type { CSSProperties } from 'react';
import { useColorCss } from '@weasel-js/theme/react';
import type { AxesSettings, GridSettings } from './Plot2D';
import s from './Plot2D.module.css';

/** Evenly spaced internal grid lines on both axes, the edges excluded: they belong to the axes. */
export function PlotGrid({ grid, width, height }: { grid: GridSettings; width: number; height: number }) {
  const css = useColorCss();
  const divisions = grid.divisions ?? 3;
  // For divisions=3, fractions are 1/4, 2/4, 3/4.
  const fractions: number[] = [];
  for (let i = 1; i <= divisions; i++) fractions.push(i / (divisions + 1));
  const color = css(grid.color);
  return (
    <g style={color === undefined ? undefined : ({ '--plot-grid': color } as CSSProperties)}>
      {fractions.map((f) => (
        <line
          key={`gx-${f}`}
          data-plot-element="grid"
          className={s.grid}
          x1={f * width} x2={f * width}
          y1={0} y2={height}
        />
      ))}
      {fractions.map((f) => (
        <line
          key={`gy-${f}`}
          data-plot-element="grid"
          className={s.grid}
          x1={0} x2={width}
          y1={f * height} y2={f * height}
        />
      ))}
    </g>
  );
}

/** The x axis along the bottom edge and the y axis along the left. */
export function PlotAxes({ axes, width, height }: { axes: AxesSettings | undefined; width: number; height: number }) {
  const css = useColorCss();
  const color = css(axes?.color);
  return (
    <g style={color === undefined ? undefined : ({ '--plot-axis': color } as CSSProperties)}>
      <line
        data-plot-element="axis"
        className={s.axis}
        x1={0} x2={width}
        y1={height} y2={height}
      />
      <line
        data-plot-element="axis"
        className={s.axis}
        x1={0} x2={0}
        y1={0} y2={height}
      />
    </g>
  );
}
