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
import { useHostAnchor } from './useHostAnchor';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';

/** Props for `<CursorCoordsHud>`. */
export interface CursorCoordsHudProps {
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Element the HUD pins its corner to. Defaults to the canvas's parent — the
   *  wrapper a bare `<canvas>` sits in. A detached canvas passes its own input
   *  box, whose parent is the shared surface every pane sits in. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  viewRef: React.RefObject<View>;
  /** Inset from the canvas's top-right corner, in px. Default 8 on both axes. */
  offset?: { top?: number; right?: number };
}

interface HudState {
  client: { x: number; y: number };
  world: { x: number; y: number } | null;
  inCanvas: boolean;
}

/** Debug overlay showing the pointer's client and world coordinates and the
 *  current frame rate, pinned to the canvas's top-right corner. */
export function CursorCoordsHud({ canvasRef, anchorRef, viewRef, offset }: CursorCoordsHudProps) {
  const [state, setState] = useState<HudState>({
    client: { x: 0, y: 0 }, world: null, inCanvas: false,
  });
  const [fps, setFps] = useState<number>(0);
  const { ref, style: anchorStyle } = useHostAnchor(
    () => anchorRef?.current ?? canvasRef.current?.parentElement ?? canvasRef.current,
    {
      align: { x: 'end', y: 'start' },
      offset: { x: offset?.right ?? 8, y: offset?.top ?? 8 },
    },
  );

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
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const view = viewRef.current;
      const client = { x: e.clientX, y: e.clientY };
      if (!canvas || !view) {
        setState({ client, world: null, inCanvas: false });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      const [wx, wy] = clientToWorld(e.clientX, e.clientY, rect, view);
      const world = { x: wx, y: wy };
      setState({ client, world, inCanvas });
    };

    document.addEventListener('pointermove', onMove);

    return () => {
      document.removeEventListener('pointermove', onMove);
    };
  }, [canvasRef, viewRef]);

  if (!anchorStyle) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        ...anchorStyle,
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
