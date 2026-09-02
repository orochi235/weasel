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
import { useHostAnchor } from './useHostAnchor';
import s from './PickHud.module.css';

/** Props for `<PickHud>`. */
export interface PickHudProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewRef: React.RefObject<View>;
  /** World-space hit-test. Same shape as `useSelectTool`'s `pickEvery`. */
  pickEvery: (worldX: number, worldY: number) => readonly string[];
  /** Optional single-best resolver — the id this point would select on a
   *  bare click. When supplied, that id is rendered bold in the list. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** Inset from the canvas's top-right corner. Default `{ top: 76, right: 8 }`
   *  so the HUD clears `CursorCoordsHud` (~64 px tall in its 3-line form). */
  offset?: { top?: number; right?: number };
}

interface HudState {
  ids: readonly string[];
  best: string | null;
  inCanvas: boolean;
}

/** Debug overlay listing every node under the pointer, with the one a click
 *  would actually select shown in bold. */
export function PickHud({ canvasRef, viewRef, pickEvery, pickBest, offset }: PickHudProps) {
  const [state, setState] = useState<HudState>({
    ids: [], best: null, inCanvas: false,
  });
  const { ref, style } = useHostAnchor(
    () => canvasRef.current?.parentElement ?? canvasRef.current,
    {
      align: { x: 'end', y: 'start' },
      offset: { x: offset?.right ?? 8, y: offset?.top ?? 76 },
    },
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      const view = viewRef.current;
      if (!canvas || !view) {
        setState({ ids: [], best: null, inCanvas: false });
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inCanvas) {
        setState({ ids: [], best: null, inCanvas: false });
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
      let best: string | null = null;
      if (pickBest) {
        try { best = pickBest(worldX, worldY); } catch { best = null; }
      }
      setState({ ids, best, inCanvas: true });
    };

    document.addEventListener('pointermove', onMove);

    return () => {
      document.removeEventListener('pointermove', onMove);
    };
  }, [canvasRef, viewRef, pickEvery, pickBest]);

  if (!style) return null;

  return (
    <div ref={ref} className={s.hud} style={style}>
      <div className={s.header}>pickEvery ({state.ids.length})</div>
      {state.ids.length === 0 ? (
        <div className={s.empty}>{state.inCanvas ? '—' : 'off-canvas'}</div>
      ) : (
        <ul className={s.list}>
          {/* pickEvery returns back-to-front (topmost last). Display top-first. */}
          {state.ids.slice().reverse().map((id) => (
            <li
              key={id}
              className={id === state.best ? `${s.item} ${s.itemBest}` : s.item}
            >
              {id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
