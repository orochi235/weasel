/**
 * Dev HUD listing the ids returned by `pickEvery(world)` under the cursor.
 *
 * Anchors to the canvas's top-right corner like `CursorCoordsHud`, offset
 * downward so it sits just below that HUD. Updates on `document`
 * pointermove. Refreshes its position on scroll / resize so it tracks the
 * canvas through layout changes.
 */
import { useEffect, useState } from 'react';
import type { View } from 'core/viewport/view';
import s from './PickHud.module.css';

export interface PickHudProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewRef: React.RefObject<View>;
  /** World-space hit-test. Same shape as `useSelectTool`'s `pickEvery`. */
  pickEvery: (worldX: number, worldY: number) => readonly string[];
  /** Inset from the canvas's top-right corner. Default `{ top: 76, right: 8 }`
   *  so the HUD clears `CursorCoordsHud` (~64 px tall in its 3-line form). */
  offset?: { top?: number; right?: number };
}

interface HudState {
  ids: readonly string[];
  inCanvas: boolean;
  anchor: { top: number; right: number } | null;
}

export function PickHud({ canvasRef, viewRef, pickEvery, offset }: PickHudProps) {
  const [state, setState] = useState<HudState>({
    ids: [], inCanvas: false, anchor: null,
  });

  useEffect(() => {
    const readAnchor = (): HudState['anchor'] => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const host = canvas.parentElement ?? canvas;
      const rect = host.getBoundingClientRect();
      return { top: rect.top, right: window.innerWidth - rect.right };
    };

    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const view = viewRef.current;
      const anchor = readAnchor();
      if (!canvas || !view) {
        setState({ ids: [], inCanvas: false, anchor });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inCanvas) {
        setState({ ids: [], inCanvas: false, anchor });
        return;
      }
      const worldX = (e.clientX - rect.left) / view.scale.x + view.x;
      const worldY = (e.clientY - rect.top)  / view.scale.y + view.y;
      let ids: readonly string[] = [];
      try {
        ids = pickEvery(worldX, worldY);
      } catch {
        ids = [];
      }
      setState({ ids, inCanvas: true, anchor });
    };

    const onLayout = () => setState((s) => ({ ...s, anchor: readAnchor() }));

    document.addEventListener('pointermove', onMove);
    window.addEventListener('scroll', onLayout, true);
    window.addEventListener('resize', onLayout);
    setState((s) => ({ ...s, anchor: readAnchor() }));

    return () => {
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onLayout, true);
      window.removeEventListener('resize', onLayout);
    };
  }, [canvasRef, viewRef, pickEvery]);

  if (!state.anchor) return null;

  const top = state.anchor.top + (offset?.top ?? 76);
  const right = state.anchor.right + (offset?.right ?? 8);
  const style = { top, right };

  return (
    <div className={s.hud} style={style}>
      <div className={s.header}>pickEvery ({state.ids.length})</div>
      {state.ids.length === 0 ? (
        <div className={s.empty}>{state.inCanvas ? '—' : 'off-canvas'}</div>
      ) : (
        <ul className={s.list}>
          {/* pickEvery returns back-to-front (topmost last). Display top-first. */}
          {state.ids.slice().reverse().map((id) => (
            <li key={id} className={s.item}>{id}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
