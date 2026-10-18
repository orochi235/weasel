import type { FeaturePreset, SnapSource, SurfaceContribution } from '@weasel-js/core';
import { alignmentSnapSource } from '../sources/alignment';
import { spacingSnapSource } from '../sources/spacing';
import { distanceReadout, type DistanceReadoutOptions } from './distanceReadout';

/** Options for `createSpacingHintsPreset`. */
export interface SpacingHintsOptions {
  /** Preset id. Default `'spacingHints'`. */
  id?: string;
  /** Snap a move so its gap to a neighbor equals one already between its
   *  siblings, and mark the equal gaps. Default true. */
  spacing?: boolean;
  /** Snap to the siblings' edges and centers too, and mark the line met.
   *  Default false. */
  align?: boolean;
  /** Snap distance in screen px. Default the canvas's reach. */
  tolerance?: number;
  /** The Alt-hover distance readout, configured, or `false` for none. Default
   *  on, with the preset's `color`. */
  readout?: false | Omit<DistanceReadoutOptions, 'color'>;
  /** The color of the marks and the readout. */
  color?: string;
}

/**
 * Spacing hints as one `<SceneCanvas features>` preset: snap sources for
 * equal spacing between siblings and, if asked, alignment to their edges
 * and centers, whose marks the canvas's snap readout draws; and holding Alt
 * over a shape measures its distance from the selection.
 */
export function createSpacingHintsPreset(opts: SpacingHintsOptions = {}): FeaturePreset {
  const id = opts.id ?? 'spacingHints';
  const color = opts.color === undefined ? {} : { color: opts.color };
  const own = { ...color, ...(opts.tolerance === undefined ? {} : { reachPx: opts.tolerance }) };
  const snapSources: SnapSource[] = [
    ...(opts.spacing ?? true ? [spacingSnapSource(own)] : []),
    ...(opts.align ?? false ? [alignmentSnapSource(own)] : []),
  ];
  const contributions: SurfaceContribution[] = [];
  if (opts.readout !== false) contributions.push(distanceReadout({ ...opts.readout, ...color }));
  return { id, snapSources, contributions };
}
