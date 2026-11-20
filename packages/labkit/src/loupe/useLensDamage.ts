import { layoutBoxOf, useLatest } from '@weasel-js/core';
import { type RefObject, useCallback, useRef } from 'react';
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

/**
 * The `onLens` a loupe reports through: the host's own, and for a hollow lens on a tiled surface, the damage each move
 * does — the host draws a hollow lens into the tiles under it, so the tiles it left and landed on both redraw. Undefined
 * when there is neither to report to.
 */
export function useLensDamage(
  hollow: boolean | undefined,
  onLens: ((lens: LoupeLens | null) => void) | undefined,
  host: RefObject<RefObject<HTMLElement | null>>,
): ((lens: LoupeLens | null) => void) | undefined {
  const tiles = useSurfaceOptional();
  const onLensLatest = useLatest(onLens);
  // Kept in the host's px and converted when it is invalidated: the host may have scrolled since it was drawn.
  const was = useRef<LoupeLens | null>(null);
  const damage = hollow ? tiles : null;
  const report = useCallback(
    (lens: LoupeLens | null) => {
      onLensLatest.current?.(lens);
      if (!damage) return;
      const el = host.current.current;
      for (const box of [was.current, lens]) if (box && el) damage.invalidateBox(clientBoxOf(el, box));
      was.current = lens;
    },
    [damage, onLensLatest, host],
  );
  return onLens || damage ? report : undefined;
}
