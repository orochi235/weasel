import type { ContributionDepReader, FeaturePreset, MoveBehavior, SurfaceContribution } from '@weasel-js/core';
import { alignMoveBehavior } from '../guides/alignment/behaviors';
import { deriveAlignmentGuides } from '../guides/alignment/derive';
import { siblingBounds } from '../guides/alignment/sceneBounds';
import { createGuidesLayer } from '../guides/layer';
import type { Guide, SpacingGap } from '../guides/types';
import { distanceReadout, type DistanceReadoutOptions } from './distanceReadout';

/** Options for `createSpacingHintsPreset`. */
export interface SpacingHintsOptions {
  /** Preset id, and the id of the layer marking the gaps. Default `'spacingHints'`. */
  id?: string;
  /** Snap a move so its gap to a neighbor equals one already between its
   *  siblings, and mark the equal gaps. Default true. */
  spacing?: boolean;
  /** Snap a move to its siblings' edges and centers too, and draw the line it
   *  meets. Default false. */
  align?: boolean;
  /** Snap distance in screen px. Default the `targets.guideSnapPx` kit
   *  setting, else `DEFAULT_GUIDE_TOLERANCE_PX`. */
  tolerance?: number;
  /** The Alt-hover distance readout, configured, or `false` for none. Default
   *  on, with the preset's `color`. */
  readout?: false | Omit<DistanceReadoutOptions, 'color'>;
  /** The color of the marks and the readout. */
  color?: string;
}

/**
 * Spacing hints as one `<SceneCanvas features>` preset: a move snaps the
 * selection to the spacing between its siblings and marks the equal gaps, and
 * holding Alt over a shape measures its distance from the selection. The move
 * snap rides any move a preset binds (`'move'`, `'draw'`), after the select
 * tool's own snap.
 *
 * Build one per canvas, in a `useMemo`: the preset holds what it last
 * published, and reads that canvas's `scene` and `selection` deps.
 */
export function createSpacingHintsPreset(opts: SpacingHintsOptions = {}): FeaturePreset {
  const id = opts.id ?? 'spacingHints';
  const spacing = opts.spacing ?? true;
  const align = opts.align ?? false;
  let deps: ContributionDepReader | null = null;
  let guides: readonly Guide[] = [];
  let gaps: readonly SpacingGap[] = [];

  const siblings = () => {
    const scene = deps?.get('scene');
    const selection = deps?.get('selection');
    return scene && selection ? siblingBounds(scene, selection.get()) : [];
  };

  const moveBehaviors: MoveBehavior<unknown>[] = spacing || align
    ? [alignMoveBehavior<unknown>({
      tolerance: opts.tolerance,
      getCandidates: () => (align ? deriveAlignmentGuides(siblings()) : []),
      setActiveGuides: (g) => { guides = g; },
      ...(spacing ? { getSpacingTargets: siblings, setActiveGaps: (g: readonly SpacingGap[]) => { gaps = g; } } : {}),
    })]
    : [];

  const marks: SurfaceContribution = {
    id: `${id}.marks`,
    eligibility: { always: true },
    overlay: createGuidesLayer({
      id,
      label: 'Spacing hints',
      getGuides: () => guides,
      getGaps: () => gaps,
      color: opts.color,
    }),
    attach: (_api, reader) => {
      deps = reader;
      return () => { deps = null; };
    },
  };

  const contributions: SurfaceContribution[] = [marks];
  if (opts.readout !== false) contributions.push(distanceReadout({ ...opts.readout, color: opts.color }));

  return { id, moveBehaviors, contributions };
}
