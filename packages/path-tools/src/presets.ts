/**
 * The package's behavior as `<SceneCanvas features>` presets: one per tool
 * family, and `pathToolsPreset` for all of them. Each assumes `pathsPreset`, which
 * opens a path for editing; `pathToolsPreset` includes it.
 */
import { never, type FeaturePreset } from '@weasel-js/core';
import { booleansPreset } from '@weasel-js/editing';
import { poiseHandlesAction, equalizeHandlesAction } from './poise/poiseHandles';
import { createPoiseExtension, PATH_POISE_CHROME_ID, type PathEditPoiseStyle } from './poise/poiseMarks';
import { bridgeAnchorsAction, bridgePathsAction } from './bridge/bridge';
import { createCombExtension, PATH_COMB_CHROME_ID, type PathEditCombOptions } from './comb/comb';
import { cycleFilletAction, setFilletsAction } from './fillet/filletCommands';
import { createFilletWidgetsExtension, type FilletWidgetStyle } from './fillet/filletWidgets';
import { editFilletAction } from './fillet/editFillet';
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from './constraints/anchorConstraints';
import type { ConstraintGlyphStyle } from './constraints/constraintGlyphs';
import { createConstraintsExtension, DEFAULT_CONSTRAINT_STYLE } from './constraints/constraintsExtension';
import { createConstraintLinkMarks } from './constraints/constraintLinkMarks';
import { linkAnchorAction } from './constraints/linkAnchor';
import { reachToMeetAction } from './reach/reachToMeet';
import { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
import { createHandleSnapExtension, handleSnapSource, type HandleSnapOptionsInput } from './handleSnap/handleSnap';
import { createDrapeExtension, type DrapeOptions } from './drape/drape';
import { fairAnchorsAction } from './fairing/fairing';
import { tugPathAction } from './tug/tugPath';
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
  bendAlongAction, tweenAction, editPathEffectAction, expandPathEffectAction, puckerBloatAction, repeatAlongAction,
  roughenAction, textAlongAction, zigzagAction,
} from './pathEffects/actions';
import { releasePathEffectAction, setEffectPathAction } from './pathEffects/retarget';
import { releaseTweenSpineAction, setTweenSpineAction } from './pathEffects/spine';
import { sandAction } from './sand/sand';
import { kneadAction } from './knead/knead';
import { spiroPreset } from './spiro/spiroPreset';
import { snipPathAction } from './snip/snip';
import { showPoiseAction, showCombAction, showFilletsAction, showDirectionAction } from './overlays/showOverlay';
import { configureWarpAction, expandWarpAction } from './warp/warpActions';
import { pathsPreset } from './pathsPreset';

/** `sand`, which `useSandTool`, a path-edit tool, binds. */
export const sandPreset: FeaturePreset = {
  id: 'sand',
  actions: [sandAction],
};

/** The `handleLock.angle` and `handleLock.length` toggles. */
export const handleLocksPreset: FeaturePreset = {
  id: 'handleLocks',
  actions: [handleLockAngleAction, handleLockLengthAction],
};

/**
 * Drape: dragging anchors in path edit also moves the anchors near
 * them along the path, by a falloff over `options`' radius, read as each drag
 * starts. The wheel scrubs the radius mid-drag. Null or undefined from
 * `options` leaves a drag hard.
 */
export function createDrapePreset(options: () => DrapeOptions | null | undefined): FeaturePreset {
  return { id: 'drape', pathEdit: [createDrapeExtension(options)] };
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

/** `snipPath`, which `useSnipTool` binds. */
export const snipPreset: FeaturePreset = { id: 'snip', actions: [snipPathAction] };

/** `reachToMeet`, which `useReachTool` binds. */
export const reachPreset: FeaturePreset = { id: 'reach', actions: [reachToMeetAction] };

/** `tugPath`, which `useTugTool`, a path-edit tool, binds. */
export const tugPreset: FeaturePreset = {
  id: 'tug',
  actions: [tugPathAction],
};

/** `knead`, which `useKneadTool` binds. */
export const kneadPreset: FeaturePreset = { id: 'knead', actions: [kneadAction] };

/** Fairing, which makes smooth anchors curvature-continuous by their handle lengths. */
export const fairingPreset: FeaturePreset = { id: 'fairing', actions: [fairAnchorsAction] };

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
 *  frame. Off until chrome-caps shows `path-edit.comb`, which its toggle,
 *  `pathEdit.show.comb`, does. */
export function createCurvatureCombPreset(options: () => PathEditCombOptions | undefined = () => undefined): FeaturePreset {
  return {
    id: 'curvatureComb',
    actions: [showCombAction],
    chromeRules: { [PATH_COMB_CHROME_ID]: never },
    pathEdit: [createCombExtension(options)],
  };
}

/** The curvature comb with its default look. */
export const curvatureCombPreset: FeaturePreset = createCurvatureCombPreset();

/**
 * Poise: a line between each curved segment's handle tips with a
 * grip to drag (`poiseHandles`) or double-click (`equalizeHandles`), drawn
 * in `style`. Off until chrome-caps shows `path-edit.poise`, which its toggle,
 * `pathEdit.show.poise`, does. It refines `paths`, so a grip's double-click
 * goes ahead of entering path edit.
 */
export function createPoisePreset(style: PathEditPoiseStyle = {}): FeaturePreset {
  return {
    id: 'poise',
    refines: ['paths'],
    actions: [equalizeHandlesAction, poiseHandlesAction, showPoiseAction],
    chromeRules: { [PATH_POISE_CHROME_ID]: never },
    pathEdit: [createPoiseExtension(style)],
  };
}

/** Poise with their default look. */
export const poisePreset: FeaturePreset = createPoisePreset();

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
 * Fillet: a widget inside each corner anchor of the open path, drawn in
 * `style`, whose drag sets the corner's radius (`editFillet`), and the
 * commands on the selected corners (`setFillets`, `cycleFillet`). The
 * widgets show while chrome-caps shows `path-edit.fillets`, which is on by
 * default; `pathEdit.show.fillets` toggles it. It refines `paths`, so a
 * widget's drag goes ahead of the marquee.
 */
export function createFilletPreset(style: FilletWidgetStyle = {}): FeaturePreset {
  return {
    id: 'fillet',
    refines: ['paths'],
    actions: [editFilletAction, setFilletsAction, cycleFilletAction, showFilletsAction],
    pathEdit: [createFilletWidgetsExtension(style)],
  };
}

/** Fillet with path edit's anchor colors. */
export const filletPreset: FeaturePreset = createFilletPreset();

/**
 * Where a path starts and which way it runs: `setPathStart` and
 * `reversePath`, and arrows and start rings over the open path, drawn in
 * `style`. The marks are off until chrome-caps shows `path-edit.direction`,
 * which their toggle, `pathEdit.show.direction`, does.
 */
export function createPathStructurePreset(style: PathDirectionStyle = {}): FeaturePreset {
  return {
    id: 'pathStructure',
    actions: [setPathStartAction, reversePathAction, showDirectionAction],
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

/** Tween, Bend along, Repeat along, Text along, Roughen, Zigzag, and Pucker
 *  & Bloat, live, and the actions that edit, expand, and release them, set an
 *  along effect's path, and set or release a tween's spine. The scene must
 *  hold `withPathEffectsRegistry`'s derivations. */
export const pathEffectsPreset: FeaturePreset = {
  id: 'pathEffects',
  actions: [
    tweenAction, bendAlongAction, repeatAlongAction, roughenAction, zigzagAction, puckerBloatAction,
    editPathEffectAction, expandPathEffectAction, setTweenSpineAction, releaseTweenSpineAction, textAlongAction,
    releasePathEffectAction, setEffectPathAction,
  ],
};

/** `expandWarp` and `configureWarp`; the warp tools bring their own drags. */
export const warpPreset: FeaturePreset = {
  id: 'warp',
  actions: [expandWarpAction, configureWarpAction],
};

/** `pathsPreset`, every preset above, spiro curves, the comb, poise, constraints, path
 *  direction, and fillets with their defaults — except Drape and
 *  handle snapping, which change what every anchor or handle drag does — and editing's `booleansPreset`, the
 *  `booleansAdapter` the shape builder works through. */
export const pathToolsPreset: FeaturePreset = {
  id: 'pathTools',
  includes: [
    pathsPreset, sandPreset, handleLocksPreset, bridgePreset, spiroPreset, snipPreset, reachPreset, tugPreset,
    kneadPreset, fairingPreset, anchorSelectionPreset, resamplePreset, addExtremesPreset,
    curvatureCombPreset, poisePreset, constraintsPreset, pathStructurePreset, segmentTypePreset,
    filletPreset, pathEffectsPreset, warpPreset, booleansPreset,
  ],
};
