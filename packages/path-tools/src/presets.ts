/**
 * The package's behavior as `<SceneCanvas features>` presets: one per tool
 * family, and `pathTools` for all of them. Each assumes core's `paths`
 * preset, which opens a path for editing.
 */
import { never, type FeaturePreset } from '@weasel-js/core';
import { balanceHandlesAction, equalizeHandlesAction } from './balance/handleBalance';
import { createBalanceExtension, PATH_BALANCE_CHROME_ID, type PathEditBalanceStyle } from './balance/balanceMarks';
import { bridgeAnchorsAction, bridgePathsAction } from './bridge/bridge';
import { createCombExtension, PATH_COMB_CHROME_ID, type PathEditCombOptions } from './comb/comb';
import { cycleCornerShapeAction, setCornersAction } from './cornerShape/cornerCommands';
import { createCornerWidgetsExtension, type CornerWidgetStyle } from './cornerShape/cornerWidgets';
import { editCornerAction } from './cornerShape/editCorner';
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from './constraints/anchorConstraints';
import type { ConstraintGlyphStyle } from './constraints/constraintGlyphs';
import { createConstraintsExtension, DEFAULT_CONSTRAINT_STYLE } from './constraints/constraintsExtension';
import { createConstraintLinkMarks } from './constraints/constraintLinkMarks';
import { linkAnchorAction } from './constraints/linkAnchor';
import { extendToMeetAction } from './extend/extendToMeet';
import { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
import { createHandleSnapExtension, handleSnapSource, type HandleSnapOptionsInput } from './handleSnap/handleSnap';
import { createSoftSelectionExtension, type SoftSelectionOptions } from './softSelection/softSelection';
import { harmonizeAnchorsAction } from './harmonize/harmonize';
import { lengthenPathAction, lengthenToolAction } from './lengthen/lengthenPath';
import { createDirectionExtension, PATH_DIRECTION_CHROME_ID, type PathDirectionStyle } from './pathStructure/directionMarks';
import { reversePathAction, setPathStartAction } from './pathStructure/pathStructure';
import { convertSegmentAtAction, convertSegmentsAction } from './segmentType/convertSegments';
import {
  growAnchorSelectionAction, invertAnchorSelectionAction, selectCornerAnchorsAction, selectEveryNthAnchorAction,
  selectSmoothAnchorsAction, shrinkAnchorSelectionAction,
} from './anchorSelect/anchorSelect';
import { addExtremeAnchorsAction } from './extremes/addExtremes';
import { resamplePathAction } from './resample/resample';
import {
  bendAlongAction, blendAction, editPathEffectAction, expandPathEffectAction, repeatAlongAction, textAlongAction,
} from './pathEffects/actions';
import { releasePathEffectAction, setEffectPathAction } from './pathEffects/retarget';
import { releaseBlendSpineAction, setBlendSpineAction } from './pathEffects/spine';
import { simplifyBrushAction, simplifyBrushToolAction } from './simplifyBrush/simplifyBrush';
import { smudgeBrushAction } from './smudge/smudgeBrush';
import { spiroPreset } from './spiro/spiroPreset';
import { trimPathAction } from './trim/trimSegment';
import { configureWarpAction, expandWarpAction } from './warp/warpActions';

/** The Simplify brush, a path-edit tool that refits the curve it passes over. */
export const simplifyBrushPreset: FeaturePreset = {
  id: 'simplifyBrush',
  actions: [simplifyBrushAction, simplifyBrushToolAction],
};

/** The `handleLock.angle` and `handleLock.length` toggles. */
export const handleLocksPreset: FeaturePreset = {
  id: 'handleLocks',
  actions: [handleLockAngleAction, handleLockLengthAction],
};

/**
 * Soft selection: dragging anchors in path edit also moves the anchors near
 * them along the path, by a falloff over `options`' radius, read as each drag
 * starts. The wheel scrubs the radius mid-drag. Null or undefined from
 * `options` leaves a drag hard.
 */
export function createSoftSelectionPreset(options: () => SoftSelectionOptions | null | undefined): FeaturePreset {
  return { id: 'softSelection', pathEdit: [createSoftSelectionExtension(options)] };
}

/**
 * Handle snapping: a dragged control handle's angle snaps to steps and to the
 * line through its anchor's other handle, as `options` says. A thunk is read
 * every move, and null or undefined from it leaves the handle unsnapped.
 */
export function createHandleSnapPreset(options: HandleSnapOptionsInput = {}): FeaturePreset {
  return { id: 'handleSnap', pathEdit: [createHandleSnapExtension(options)], snapSources: [handleSnapSource(options)] };
}

/** Handle snapping every 45°, within 6°, and to the opposite handle. */
export const handleSnapPreset: FeaturePreset = createHandleSnapPreset();

/** Bridge, on whole paths and on two selected anchors. */
export const bridgePreset: FeaturePreset = {
  id: 'bridge',
  actions: [bridgeAnchorsAction, bridgePathsAction],
};

/** `trimPath`, which `useTrimTool` binds. */
export const trimPreset: FeaturePreset = { id: 'trim', actions: [trimPathAction] };

/** `extendToMeet`, which `useExtendTool` binds. */
export const extendPreset: FeaturePreset = { id: 'extend', actions: [extendToMeetAction] };

/** Lengthen, a path-edit tool whose drag on an open end grows or trims the
 *  path from that end, and its toggle. */
export const lengthenPreset: FeaturePreset = {
  id: 'lengthen',
  actions: [lengthenPathAction, lengthenToolAction],
};

/** `smudgeBrush`, which `useSmudgeBrushTool` binds. */
export const smudgePreset: FeaturePreset = { id: 'smudge', actions: [smudgeBrushAction] };

/** Harmonize curvature. */
export const harmonizePreset: FeaturePreset = { id: 'harmonize', actions: [harmonizeAnchorsAction] };

/** Anchor selection along the path: grow, shrink, every Nth, corners, smooth
 *  anchors, and the complement. */
export const anchorSelectionPreset: FeaturePreset = {
  id: 'anchorSelection',
  actions: [
    growAnchorSelectionAction, shrinkAnchorSelectionAction, selectEveryNthAnchorAction,
    selectCornerAnchorsAction, selectSmoothAnchorsAction, invertAnchorSelectionAction,
  ],
};

/** Resample, which spreads anchors evenly by arc length. */
export const resamplePreset: FeaturePreset = { id: 'resample', actions: [resamplePathAction] };

/** Add extremes, an anchor at each curve's leftmost, rightmost, top, and bottom. */
export const addExtremesPreset: FeaturePreset = { id: 'addExtremes', actions: [addExtremeAnchorsAction] };

/** The curvature comb over the open path, drawn as `options` says, read every
 *  frame. Off until chrome-caps shows `path-edit.comb`. */
export function createCurvatureCombPreset(options: () => PathEditCombOptions | undefined = () => undefined): FeaturePreset {
  return {
    id: 'curvatureComb',
    chromeRules: { [PATH_COMB_CHROME_ID]: never },
    pathEdit: [createCombExtension(options)],
  };
}

/** The curvature comb with its default look. */
export const curvatureCombPreset: FeaturePreset = createCurvatureCombPreset();

/**
 * Balance handles: a line between each curved segment's handle tips with a
 * grip to drag (`balanceHandles`) or double-click (`equalizeHandles`), drawn
 * in `style`. Off until chrome-caps shows `path-edit.balance`. It refines
 * `paths`, so a grip's double-click goes ahead of entering path edit.
 */
export function createBalancePreset(style: PathEditBalanceStyle = {}): FeaturePreset {
  return {
    id: 'balance',
    refines: ['paths'],
    actions: [equalizeHandlesAction, balanceHandlesAction],
    chromeRules: { [PATH_BALANCE_CHROME_ID]: never },
    pathEdit: [createBalanceExtension(style)],
  };
}

/** Balance handles with their default look. */
export const balancePreset: FeaturePreset = createBalancePreset();

/** Path constraints: their actions, Alt-dragging an anchor onto another
 *  node to link it there, their marks in `style`'s colors, broken links
 *  marked wherever they are, and every edit of a constrained path finished
 *  so they hold. */
export function createConstraintsPreset(style: Partial<ConstraintGlyphStyle> = {}): FeaturePreset {
  return {
    id: 'constraints',
    actions: [constrainAnchorsAction, unconstrainAnchorsAction, deleteConstraintAction, linkAnchorAction],
    pathEdit: [createConstraintsExtension(style)],
    contributions: [createConstraintLinkMarks({ ...DEFAULT_CONSTRAINT_STYLE, ...style })],
  };
}

/** Path constraints with their default colors. */
export const constraintsPreset: FeaturePreset = createConstraintsPreset();

/**
 * Corner shape: a widget inside each corner anchor of the open path, drawn in
 * `style`, whose drag sets the corner's radius (`editCorner`), and the
 * commands on the selected corners (`setCorners`, `cycleCornerShape`). The
 * widgets show while chrome-caps shows `path-edit.corners`, which is on by
 * default. It refines `paths`, so a widget's drag goes ahead of the marquee.
 */
export function createCornerShapePreset(style: CornerWidgetStyle = {}): FeaturePreset {
  return {
    id: 'cornerShape',
    refines: ['paths'],
    actions: [editCornerAction, setCornersAction, cycleCornerShapeAction],
    pathEdit: [createCornerWidgetsExtension(style)],
  };
}

/** Corner shape with path edit's anchor colors. */
export const cornerShapePreset: FeaturePreset = createCornerShapePreset();

/**
 * Where a path starts and which way it runs: `setPathStart` and
 * `reversePath`, and arrows and start rings over the open path, drawn in
 * `style`. The marks are off until chrome-caps shows `path-edit.direction`.
 */
export function createPathStructurePreset(style: PathDirectionStyle = {}): FeaturePreset {
  return {
    id: 'pathStructure',
    actions: [setPathStartAction, reversePathAction],
    chromeRules: { [PATH_DIRECTION_CHROME_ID]: never },
    pathEdit: [createDirectionExtension(style)],
  };
}

/** Path start and direction with the marks' default look. */
export const pathStructurePreset: FeaturePreset = createPathStructurePreset();

/** `convertSegments` and `convertSegmentAt`, turning segments straight or
 *  curved. It refines `paths`, so a segment's Shift+double-click goes ahead
 *  of entering path edit. */
export const segmentTypePreset: FeaturePreset = {
  id: 'segmentType',
  refines: ['paths'],
  actions: [convertSegmentsAction, convertSegmentAtAction],
};

/** Blend, Bend along, Repeat along, and Text along, live, and the actions
 *  that edit, expand, and release them, set an along effect's path, and set
 *  or release a blend's spine. The scene must hold
 *  `withPathEffectsRegistry`'s derivations. */
export const pathEffectsPreset: FeaturePreset = {
  id: 'pathEffects',
  actions: [
    blendAction, bendAlongAction, repeatAlongAction, editPathEffectAction, expandPathEffectAction,
    setBlendSpineAction, releaseBlendSpineAction, textAlongAction, releasePathEffectAction, setEffectPathAction,
  ],
};

/** `expandWarp` and `configureWarp`; the warp tools bring their own drags. */
export const warpPreset: FeaturePreset = {
  id: 'warp',
  actions: [expandWarpAction, configureWarpAction],
};

/** Every preset above, spiro curves, the comb, balance, constraints, path
 *  direction, and corner shape with their defaults — except soft selection and
 *  handle snapping, which change what every anchor or handle drag does. */
export const pathTools: FeaturePreset = {
  id: 'pathTools',
  includes: [
    simplifyBrushPreset, handleLocksPreset, bridgePreset, spiroPreset, trimPreset, extendPreset, lengthenPreset,
    smudgePreset, harmonizePreset, anchorSelectionPreset, resamplePreset, addExtremesPreset,
    curvatureCombPreset, balancePreset, constraintsPreset, pathStructurePreset, segmentTypePreset,
    cornerShapePreset, pathEffectsPreset, warpPreset,
  ],
};
