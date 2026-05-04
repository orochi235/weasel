import { useRef } from 'react';

/** Live viewport-pan state captured at gesture start. */
export interface ActivePan {
  x: number;
  y: number;
  setPan: (x: number, y: number) => void;
}

/**
 * Pan-on-drag interaction. The caller supplies `getActive`, which is read
 * at pan-start so the appropriate viewport is captured for the duration of
 * the gesture (useful when the app has multiple viewports — e.g. a main
 * canvas plus a separate seed-starting view).
 *
 * @deprecated Phase 2b ships `useHandTool` from `@orochi235/weasel/tools`
 * which integrates with `<Canvas view={...} />`. This hook uses
 * `React.MouseEvent` and an inverted (additive) sign convention — incompatible
 * with the Tool primitive dispatcher and the new `View` shape. Removal is
 * scheduled for Phase 2c once consumers (currently only the bezier-zoom doc
 * reference) have migrated.
 */
export function usePan(getActive: () => ActivePan) {
  const isPanning = useRef(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const activeSetPan = useRef<(x: number, y: number) => void>(() => {});

  function start(e: React.MouseEvent) {
    isPanning.current = true;
    const cur = getActive();
    activeSetPan.current = cur.setPan;
    panStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: cur.x, panY: cur.y };
  }

  function move(e: React.MouseEvent) {
    if (!isPanning.current) return false;
    const dx = e.clientX - panStart.current.mouseX;
    const dy = e.clientY - panStart.current.mouseY;
    activeSetPan.current(panStart.current.panX + dx, panStart.current.panY + dy);
    return true;
  }

  function end() {
    isPanning.current = false;
  }

  return { start, move, end, isPanning };
}
