import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import type { TrackRun, TrackShape } from '@weasel-js/geom';
import { inlineDirection, type RovingDirection } from '../../useRovingTabIndex';
import { rowRun } from './rowRun';

/** `root`'s computed `direction`, `'ltr'` until it has mounted. Read after every commit, before the paint. */
export function useInlineDirection(root: RefObject<HTMLElement | null>): RovingDirection {
  const [direction, setDirection] = useState<RovingDirection>('ltr');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- an ancestor's `dir` can change with no prop here, so every commit rereads it
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- computed direction is only readable from a committed layout; an equal value bails
    if (root.current) setDirection(inlineDirection(root.current));
  });
  return direction;
}

/** {@link rowRun} for a row under `root`, in `root`'s computed `direction`. */
export function useRowRun(root: RefObject<HTMLElement | null>, shape: TrackShape): TrackRun {
  const direction = useInlineDirection(root);
  return useMemo(() => rowRun(shape, direction), [shape, direction]);
}
