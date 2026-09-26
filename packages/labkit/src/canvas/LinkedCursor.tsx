import { crosshairRects, usePointerPosition } from '@weasel-js/core';
import { useContext } from 'react';
import { CameraContext, pointerElsewhere, STAGE_VIEW_ID } from './CameraInput';

/** `crosshairRects` returns its four arms in this order. */
const ARMS = ['left', 'right', 'up', 'down'] as const;

/**
 * The other side of a linked cursor: a crosshair on the camera's own element
 * wherever the shared pointer is over some other view — an overview, say. The
 * same crosshair core paints on a weasel canvas.
 */
export function LinkedCursor() {
  const camera = useContext(CameraContext);
  const pointer = usePointerPosition();
  if (!camera) return null;
  const local = pointerElsewhere(pointer, STAGE_VIEW_ID, camera.frame);
  if (!local) return null;
  // `pointerElsewhere` hands back the instrument's world; the camera works
  // frame-local, and the map is its own inverse.
  const v = camera.view.get();
  const x = (local.x - v.x) * v.scale.x;
  const y = (local.y * camera.frame.yDir - v.y) * v.scale.y;
  const { halo, bars } = crosshairRects(x, y, 1);
  const arms = ARMS.map((name, i) => ({ name, halo: halo[i], bar: bars[i] }));
  return (
    <svg className="lk-linked-cursor" aria-hidden="true">
      {arms.map(({ name, halo: r }) =>
        r ? (
          <rect
            key={`halo-${name}`}
            className="lk-linked-cursor__halo"
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
          />
        ) : null,
      )}
      {arms.map(({ name, bar: r }) =>
        r ? (
          <rect
            key={`bar-${name}`}
            className="lk-linked-cursor__bar"
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
          />
        ) : null,
      )}
    </svg>
  );
}
