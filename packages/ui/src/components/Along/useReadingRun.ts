import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { trackRun, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { inlineDirection, type RovingDirection } from '../../useRovingTabIndex';

/**
 * `shape` as a row of items under `root` reads it: from the right end when `root`'s computed `direction` is `rtl`, as
 * the same row laid out straight would start. Read after every commit, before the paint.
 */
export function useReadingRun(root: RefObject<HTMLElement | null>, shape: TrackShape): TrackRun {
  const [direction, setDirection] = useState<RovingDirection>('ltr');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- an ancestor's `dir` can change with no prop here, so every commit rereads it
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- computed direction is only readable from a committed layout; an equal value bails
    if (root.current) setDirection(inlineDirection(root.current));
  });
  return useMemo(() => trackRun(shape, 0, 1, { direction }), [shape, direction]);
}
