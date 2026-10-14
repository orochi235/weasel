import type { MoveBehavior, SelectionApi } from '@weasel-js/core';
import {
  alignMoveBehavior,
  createGuidesLayer,
  distanceReadout,
  siblingBounds,
  type SpacingGap,
} from '@weasel-js/guides';
import { useMemo, useRef } from 'react';
import type { DrawScene, WeaselDrawPose } from './drawDocument';
import { usePref } from './prefs';

const HINT_COLOR = '#e0397f';

/**
 * Spacing hints, driven by the "Spacing hints" View preference: a move behavior that snaps the
 * selection to a gap matching one between its siblings and publishes the equal gaps, the layer
 * that marks them, and the Alt-hover distance readout to hand the canvas as an ambient entry.
 */
export function useSpacingHints(scene: DrawScene, selection: SelectionApi) {
  const [enabled] = usePref('view.spacingHints');
  const gapsRef = useRef<readonly SpacingGap[]>([]);

  const move = useMemo((): MoveBehavior<WeaselDrawPose> => alignMoveBehavior<WeaselDrawPose>({
    getCandidates: () => [],
    setActiveGuides: () => {},
    getSpacingTargets: () => siblingBounds(scene, selection.get()),
    setActiveGaps: (gaps) => { gapsRef.current = gaps; },
  }), [scene, selection]);

  const layer = useMemo(() => createGuidesLayer({
    id: 'spacingHints',
    label: 'Spacing hints',
    getGuides: () => [],
    getGaps: () => gapsRef.current,
    color: HINT_COLOR,
  }), []);

  const readout = useMemo(() => distanceReadout({ color: HINT_COLOR }), []);

  return enabled
    ? { move, layer, readout }
    : { move: undefined, layer: undefined, readout: undefined };
}
