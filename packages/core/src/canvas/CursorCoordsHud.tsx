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
import { useEffect, useRef, useState } from 'react';
import { useVisibleRaf } from '../scheduling/useVisibleRaf';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';

/** Props for `<CursorCoordsHud>`. */
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

/** Debug overlay showing the pointer's client and world coordinates and the
 *  current frame rate, pinned to the canvas's top-right corner. */
export function CursorCoordsHud({ canvasRef, viewRef, offset }: CursorCoordsHudProps) {
  const [state, setState] = useState<HudState>({
    client: { x: 0, y: 0 }, world: null, inCanvas: false, anchor: null,
  });
  const [fps, setFps] = useState<number>(0);

  // FPS counter: tally frames per rAF tick; flush once a second.
  const framesRef = useRef(0);
  const lastFlushRef = useRef(0);
  const fpsLoop = useVisibleRaf(
    () => {
      framesRef.current++;
      const now = performance.now();
      const dt = now - lastFlushRef.current;
      if (dt >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / dt));
        framesRef.current = 0;
        lastFlushRef.current = now;
      }
      fpsLoop.request();
    },
    // Frames not drawn while hidden are not frames that were slow to draw:
    // without this the readout would flush a near-zero rate on resume.
    {
      onResume: () => {
        framesRef.current = 0;
        lastFlushRef.current = performance.now();
      },
    },
  );

  useEffect(() => {
    lastFlushRef.current = performance.now();
    fpsLoop.request();
    return () => fpsLoop.cancel();
  }, [fpsLoop]);

  useEffect(() => {
    const readAnchor = (): HudState['anchor'] => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      // Anchor to the canvas's container (e.g. WeaselDraw's striped workspace),
      // falling back to the canvas itself if there's no wrapping parent.
      // The "canvas area" in editor parlance is the workspace, not the page.
      const host = canvas.parentElement ?? canvas;
      const rect = host.getBoundingClientRect();
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
      const [wx, wy] = clientToWorld(e.clientX, e.clientY, rect, view);
      const world = { x: wx, y: wy };
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
      {`fps    ${fps.toString().padStart(3)}`}
      {'\n'}
      {`client (${state.client.x.toFixed(0)}, ${state.client.y.toFixed(0)})`}
      {'\n'}
      {state.world
        ? `world  (${state.world.x.toFixed(1)}, ${state.world.y.toFixed(1)})${state.inCanvas ? '' : '  (off-canvas)'}`
        : 'world  — (no canvas/view yet)'}
    </div>
  );
}
