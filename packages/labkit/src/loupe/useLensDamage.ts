import { layoutBoxOf, useLatest } from '@weasel-js/core';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import type { Box } from '../surface/rect';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import type { LoupeLens } from './types';

/** The lens's box in client px, at whatever scale `host`, whose own px it is in, is shown. */
function clientBoxOf(host: HTMLElement, lens: LoupeLens): Box {
  const at = layoutBoxOf(host);
  return {
    left: at.left + (lens.center.x - lens.width / 2) * at.scale.x,
    top: at.top + (lens.center.y - lens.height / 2) * at.scale.y,
    width: lens.width * at.scale.x,
    height: lens.height * at.scale.y,
  };
}

/** Redraws the tiles under each lens box, in `host`'s px. */
function invalidate(
  damage: { invalidateBox: (box: Box) => void },
  host: HTMLElement | null,
  lenses: readonly (LoupeLens | null)[],
): void {
  if (!host) return;
  for (const lens of lenses) if (lens) damage.invalidateBox(clientBoxOf(host, lens));
}

/**
 * The `onLens` a loupe reports through: the host's own, and for a hollow lens on a tiled surface, the damage each move
 * does — the host draws a hollow lens into the tiles under it, so the tiles it left and landed on both redraw.
 */
export function useLensDamage(
  hollow: boolean | undefined,
  onLens: ((lens: LoupeLens | null) => void) | undefined,
  host: RefObject<RefObject<HTMLElement | null>>,
): (lens: LoupeLens | null) => void {
  const tiles = useSurfaceOptional();
  const onLensLatest = useLatest(onLens);
  // Kept in the host's px and converted when it is invalidated: the host may have scrolled since it was drawn.
  const was = useRef<LoupeLens | null>(null);
  // Every report is heard even while solid, so a lens turned hollow where it stands knows where it is.
  const last = useRef<LoupeLens | null>(null);
  const damage = hollow ? tiles : null;
  const report = useCallback(
    (lens: LoupeLens | null) => {
      onLensLatest.current?.(lens);
      last.current = lens;
      if (!damage) return;
      invalidate(damage, host.current.current, [was.current, lens]);
      was.current = lens;
    },
    [damage, onLensLatest, host],
  );
  // Turning hollow on or off, or gaining or losing the surface, leaves the tiles under the lens showing the other
  // drawing unless they redraw now.
  useEffect(() => {
    if (!damage) return;
    const redraw = () => invalidate(damage, host.current.current, [was.current]);
    was.current = last.current;
    redraw();
    return () => {
      redraw();
      was.current = null;
    };
  }, [damage, host]);
  return report;
}
