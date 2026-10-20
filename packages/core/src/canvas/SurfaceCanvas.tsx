import { forwardRef, useCallback, type CSSProperties } from 'react';
import { adoptCssOnce, assignRef } from '@weasel-js/react';

/** The CSS size of a canvas the kit renders: its `width` and `height` props,
 *  and its parent's box on an axis given neither. Zero specificity, so a class
 *  the consumer passes resizes the element.
 *
 *  A filling canvas must give its parent no size back, or the parent could
 *  never shrink. `contain: size` drops its buffer's size, but Chrome still
 *  takes the buffer's aspect ratio for an auto height, so a near-flat ratio
 *  replaces it. */
export const SURFACE_RULE =
  ':where([data-wzl-surface]) { width: var(--wzl-surface-width, 100%); height: var(--wzl-surface-height, 100%); }'
  + " :where([data-wzl-surface='fill']) { display: block; contain: size; aspect-ratio: 1000000 / 1; }";

/** Hold {@link SURFACE_RULE} in the root `el`'s styles come from, once per root. */
export function adoptSurfaceRule(el: Element): void {
  adoptCssOnce(el, SURFACE_RULE);
}

export interface SurfaceCanvasProps {
  /** CSS pixels. The renderer sizes only the drawing buffer, so without the
   *  rule this element holds it is as large as its buffer: `dpr` times too big.
   *  Omitted, the element fills its parent on that axis. */
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  tabIndex?: number;
  'aria-label'?: string;
}

/** The `<canvas>` a kit component paints into, `width` × `height` CSS pixels,
 *  or its parent's size on an axis given neither. */
export const SurfaceCanvas = forwardRef<HTMLCanvasElement, SurfaceCanvasProps>(
  function SurfaceCanvas({ width, height, className, style, tabIndex, 'aria-label': ariaLabel }, ref) {
    // Stable while `ref` is, so a commit does not detach the element.
    const setRef = useCallback((el: HTMLCanvasElement | null) => {
      if (el) adoptSurfaceRule(el);
      assignRef(ref, el);
    }, [ref]);
    const sized = {
      ...style,
      ...(width !== undefined ? { '--wzl-surface-width': `${width}px` } : {}),
      ...(height !== undefined ? { '--wzl-surface-height': `${height}px` } : {}),
    };
    const fills = width === undefined || height === undefined;
    return (
      <canvas
        ref={setRef}
        width={width}
        height={height}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        className={className}
        style={sized as CSSProperties}
        data-wzl-surface={fills ? 'fill' : ''}
      />
    );
  },
);
