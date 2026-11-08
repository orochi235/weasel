import { useLatest } from '@weasel-js/core';
import { type RefObject, useCallback, useRef } from 'react';
import type { Box } from '../surface/rect';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import type { LoupeLens } from './types';

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
  const was = useRef<Box | null>(null);
  const damage = hollow ? tiles : null;
  const report = useCallback(
    (lens: LoupeLens | null) => {
      onLensLatest.current?.(lens);
      if (!damage) return;
      const at = host.current.current?.getBoundingClientRect();
      const now =
        lens && at
          ? {
              left: at.left + lens.center.x - lens.width / 2,
              top: at.top + lens.center.y - lens.height / 2,
              width: lens.width,
              height: lens.height,
            }
          : null;
      if (was.current) damage.invalidateBox(was.current);
      if (now) damage.invalidateBox(now);
      was.current = now;
    },
    [damage, onLensLatest, host],
  );
  return onLens || damage ? report : undefined;
}
