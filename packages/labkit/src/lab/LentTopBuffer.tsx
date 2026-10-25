import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SurfaceHandle } from '../surface/useTiledSurface';

/** Props for `LentTopBuffer`. */
export interface LentTopBufferProps {
  /** The host's surface, whose container the buffer covers. */
  surface: SurfaceHandle;
  attach: (el: HTMLCanvasElement | null) => void;
}

/**
 * The `top` buffer a lab makes for itself under a host whose surface offers
 * none. It covers the host's container, which is what tile rects are measured
 * against, and is a tile of the host's surface so that its arrival and every
 * resize retile the frame. The host never sizes it, so its registered clear
 * does, before anything paints.
 */
export function LentTopBuffer({ surface, attach }: LentTopBufferProps) {
  const tileId = `lab.top${useId()}`;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas) return;
    surface.registerTile(tileId, canvas);
    const offClear = surface.registerClear(tileId, (size, dpr) => {
      const w = Math.round(size.width * dpr);
      const h = Math.round(size.height * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    });
    return () => {
      offClear();
      surface.registerTile(tileId, null);
    };
  }, [surface, tileId, canvas]);

  const container = surface.getContainer();
  if (!container) return null;
  return createPortal(
    <canvas
      className="lk-lab__surface lk-lab__surface--top lk-lab__surface--lent"
      ref={(el) => {
        attach(el);
        setCanvas(el);
      }}
    />,
    container,
  );
}
