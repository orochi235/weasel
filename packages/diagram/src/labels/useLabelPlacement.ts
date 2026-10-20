import { useLatest, type Scene } from '@weasel-js/core';
import { useEffect } from 'react';
import { installLabelPlacement, type LabelPlacementOptions } from './install';

/**
 * Move `scene`'s edge labels off whatever an edit leaves covering them, for
 * the life of the calling component, each edit's moves in its own history
 * entry. Options are read when the scene changes.
 */
export function useLabelPlacement<TPose>(scene: Scene<unknown, string, TPose>, opts: LabelPlacementOptions<TPose> = {}): void {
  const latest = useLatest(opts);
  useEffect(() => installLabelPlacement(scene, latest.current).dispose, [scene, latest]);
}
