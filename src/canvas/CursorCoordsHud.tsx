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
  /** Inset from the canvas's top-right corner, in px. Default 8 on both axes. */
  offset?: { top?: number; right?: number };
}

interface HudState {
  client: { x: number; y: number };
  world: { x: number; y: number } | null;
  inCanvas: boolean;
  /** Canvas's top-right corner in viewport coords (px from top-left).
   *  Captured at the same moment as the pointer reading so the HUD's
   *  position tracks the canvas through scroll / resize / pan. */
  anchor: { top: number; right: number } | null;
}

export function CursorCoordsHud({ canvasRef, viewRef, offset }: CursorCoordsHudProps) {
  const [state, setState] = useState<HudState>({
    client: { x: 0, y: 0 }, world: null, inCanvas: false, anchor: null,
  });

  useEffect(() => {
    const readAnchor = (): HudState['anchor'] => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      // Right = distance from the viewport's right edge.
      return { top: rect.top, right: window.innerWidth - rect.right };
    };

    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const view = viewRef.current;
      const client = { x: e.clientX, y: e.clientY };
      const anchor = readAnchor();
      if (!canvas || !view) {
        setState({ client, world: null, inCanvas: false, anchor });
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
      setState({ client, world, inCanvas, anchor });
    };

    // Refresh anchor on scroll/resize so the HUD sticks to the canvas's
    // top-right corner even when the canvas itself moves.
    const onLayout = () => setState((s) => ({ ...s, anchor: readAnchor() }));

    document.addEventListener('pointermove', onMove);
    window.addEventListener('scroll', onLayout, true);
    window.addEventListener('resize', onLayout);

    // Initial anchor read so the HUD shows before the first pointermove.
    setState((s) => ({ ...s, anchor: readAnchor() }));

    return () => {
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onLayout, true);
      window.removeEventListener('resize', onLayout);
    };
  }, [canvasRef, viewRef]);

  if (!state.anchor) return null;

  const top = state.anchor.top + (offset?.top ?? 8);
  const right = state.anchor.right + (offset?.right ?? 8);

  return (
    <div
      style={{
        position: 'fixed',
        top, right,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.7)',
        color: '#e8e8e8',
        font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: '6px 8px',
        borderRadius: 4,
        pointerEvents: 'none',
        lineHeight: 1.4,
        whiteSpace: 'pre',
        textAlign: 'right',
      }}
    >
      {`client (${state.client.x.toFixed(0)}, ${state.client.y.toFixed(0)})`}
      {'\n'}
      {state.world
        ? `world  (${state.world.x.toFixed(1)}, ${state.world.y.toFixed(1)})${state.inCanvas ? '' : '  (off-canvas)'}`
        : 'world  — (no canvas/view yet)'}
    </div>
  );
}
