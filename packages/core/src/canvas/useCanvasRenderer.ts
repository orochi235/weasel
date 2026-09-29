import { useEffect, useState } from 'react';
import { leaseCanvasRenderer, type CanvasRendererLease } from './canvasRenderer';

/**
 * The React lifetime of `leaseCanvasRenderer`: a stable `paint` for the
 * component's canvas, whose renderer and GL objects are freed on unmount.
 * Every detached canvas surface paints through this, so none can skip the
 * teardown.
 */
export function useCanvasRenderer(): CanvasRendererLease['paint'] {
  const [lease] = useState(leaseCanvasRenderer);
  useEffect(() => () => lease.release(), [lease]);
  return lease.paint;
}
