import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { CanvasSize } from 'core/viewport/clampView';
import { useElementSize } from 'core/viewport/useCanvasSize';

/** The size props every canvas host takes. */
export interface SurfaceSizeProps {
  /** CSS-pixel width. Omit it, or `height`, and the element fills its parent
   *  on that axis and is measured: the parent's box decides the size, and the
   *  canvas adds nothing to it, so the parent needs a size of its own. Nothing
   *  paints until the measurement lands. */
  width?: number;
  /** CSS-pixel height. Omit it to fill, as `width`. */
  height?: number;
  /** Every size the surface takes, once at mount and again on each change —
   *  the measured one for an axis left to fill. */
  onResize?: (size: CanvasSize) => void;
}

const NO_ELEMENT: RefObject<HTMLElement | null> = { current: null };

/**
 * The CSS-pixel size a canvas host paints at: its `width` and `height`, with
 * an axis left out measured off `element`, which fills its parent on it.
 */
export function useSurfaceSize(props: SurfaceSizeProps, element: RefObject<HTMLElement | null>): CanvasSize {
  const fills = props.width === undefined || props.height === undefined;
  const measured = useElementSize(fills ? element : NO_ELEMENT);
  const width = props.width ?? measured.width;
  const height = props.height ?? measured.height;

  const onResize = useLatest(props.onResize);
  const reported = useRef<CanvasSize | null>(null);
  useLayoutEffect(() => {
    // A filling axis reads 0 until measured, and that is no size to report.
    if (width === 0 || height === 0) return;
    const was = reported.current;
    if (was && was.width === width && was.height === height) return;
    reported.current = { width, height };
    onResize.current?.({ width, height });
  }, [width, height, onResize]);

  return { width, height };
}
