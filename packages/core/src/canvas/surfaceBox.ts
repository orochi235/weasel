/// <reference path="../css-modules.d.ts" />
import type { CSSProperties } from 'react';
import s from './surface.module.css';

/** The class and style for a `<canvas>` the kit renders at `width` × `height`
 *  CSS pixels. The renderer sizes only the drawing buffer, so without these
 *  the element is as large as its buffer: `dpr` times too big. */
export function surfaceBox(
  width: number,
  height: number,
  className?: string,
  style?: CSSProperties,
): { className: string; style: CSSProperties } {
  return {
    className: className ? `${s.surface} ${className}` : s.surface,
    style: { ...style, '--wzl-surface-width': `${width}px`, '--wzl-surface-height': `${height}px` } as CSSProperties,
  };
}
