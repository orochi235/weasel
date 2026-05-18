/**
 * Fixed-position dev HUD that shows the cursor's current viewport
 * (client) coords next to the equivalent canvas (world) coords. Mounts
 * top-left of the viewport; listens to `document` pointermove so it
 * reads the cursor even when it leaves the canvas.
 *
 * Mount inside a `<SceneCanvas>` subtree (or anywhere with access to a
 * canvas + view ref) for quick coord-reconciliation during gesture
 * debugging.
 */
import { useEffect, useState } from 'react';
import type { View } from 'core/viewport/view';

export interface CursorCoordsHudProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewRef: React.RefObject<View>;
  /** Optional visual offset from top-left (px). Default `{ top: 8, left: 8 }`. */
  offset?: { top?: number; left?: number };
}

export function CursorCoordsHud({ canvasRef, viewRef, offset }: CursorCoordsHudProps) {
  const [coords, setCoords] = useState<{
    client: { x: number; y: number };
    world: { x: number; y: number } | null;
    inCanvas: boolean;
  }>({ client: { x: 0, y: 0 }, world: null, inCanvas: false });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const view = viewRef.current;
      const client = { x: e.clientX, y: e.clientY };
      if (!canvas || !view) {
        setCoords({ client, world: null, inCanvas: false });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      const world = {
        x: (e.clientX - rect.left) / view.scale.x + view.x,
        y: (e.clientY - rect.top)  / view.scale.y + view.y,
      };
      setCoords({ client, world, inCanvas });
    };
    document.addEventListener('pointermove', onMove);
    return () => document.removeEventListener('pointermove', onMove);
  }, [canvasRef, viewRef]);

  const top = offset?.top ?? 8;
  const left = offset?.left ?? 8;

  return (
    <div
      style={{
        position: 'fixed',
        top, left,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.7)',
        color: '#e8e8e8',
        font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: '6px 8px',
        borderRadius: 4,
        pointerEvents: 'none',
        lineHeight: 1.4,
        whiteSpace: 'pre',
      }}
    >
      {`client (${coords.client.x.toFixed(0)}, ${coords.client.y.toFixed(0)})`}
      {'\n'}
      {coords.world
        ? `world  (${coords.world.x.toFixed(1)}, ${coords.world.y.toFixed(1)})${coords.inCanvas ? '' : '  (off-canvas)'}`
        : 'world  — (no canvas/view yet)'}
    </div>
  );
}
