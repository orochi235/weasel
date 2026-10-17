/**
 * Spiro curves in path edit: a spiro node is edited through its straight-sided
 * control path, whose anchors are the curve's points, and every edit solves
 * the curve again through them. Each point draws by its kind, and a press on
 * the curve between two points adds one there.
 */
import type { PathEditExtension, PathRepresentation } from '@weasel-js/core';
import { asSpiro, respiro, SPIRO_FORM, spiroEditPath } from './spiroShape';
import { spiroMarker } from './spiroMarkers';
import { spiroSegmentPress } from './spiroInsertPoint';

/** How path edit reads and writes a spiro form. */
export const spiroRepresentation: PathRepresentation = {
  kind: SPIRO_FORM,
  editPath(path, form) {
    const spiro = asSpiro(form);
    return spiro && spiroEditPath(path, spiro);
  },
  store(path, form, edited) {
    const spiro = asSpiro(form);
    const solved = spiro && respiro(path, spiro, edited);
    return solved && { path: solved.path, form: solved.spiro };
  },
  anchorMarkers: (form) => asSpiro(form)?.kinds.map(spiroMarker) ?? [],
  segmentPress: spiroSegmentPress,
};

/** The path-edit extension carrying {@link spiroRepresentation}. */
export const spiroExtension: PathEditExtension = { id: 'spiro', representation: spiroRepresentation };
