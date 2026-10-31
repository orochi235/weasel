import { useCanvasSize, type CanvasSizeSnapshot } from '@weasel-js/core';
import type { ReactNode, RefObject } from 'react';

const BEFORE_PAINT = { beforePaint: true };

/**
 * Renders `children` at `host`'s size, taken inside the resize callback so the frame the host resized in paints
 * it. What `children` renders must lay out nothing outside `host`.
 */
export function HostSized({ host, children }: {
  host: RefObject<HTMLElement | null>;
  children: (dims: CanvasSizeSnapshot) => ReactNode;
}): ReactNode {
  return children(useCanvasSize(host, BEFORE_PAINT));
}
