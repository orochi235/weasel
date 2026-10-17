import type { FeaturePreset } from '@weasel-js/core';
import { releaseSpiroAction, setSpiroKindAction } from './spiroCommands';
import { spiroExtension } from './spiroRepresentation';

/** Spiro curves: path edit edits a spiro node's points and solves the curve
 *  again through them (`spiroRepresentation`), `setSpiroKind` sets the kind
 *  of the selected points, and `releaseSpiro` converts a spiro curve to an
 *  ordinary path. `useSpiroTool` draws them. */
export const spiroPreset: FeaturePreset = {
  id: 'spiro',
  actions: [setSpiroKindAction, releaseSpiroAction],
  pathEdit: [spiroExtension],
};
