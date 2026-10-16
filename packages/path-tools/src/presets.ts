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
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from './constraints/anchorConstraints';
import type { ConstraintGlyphStyle } from './constraints/constraintGlyphs';
import { createConstraintsExtension } from './constraints/constraintsExtension';
import { extendToMeetAction } from './extend/extendToMeet';
import { handleLockAngleAction, handleLockLengthAction } from './handleLocks/handleLocks';
import { harmonizeAnchorsAction } from './harmonize/harmonize';
import {
  bendAlongAction, blendAction, editPathEffectAction, expandPathEffectAction, repeatAlongAction,
} from './pathEffects/actions';
import { simplifyBrushAction, simplifyBrushToolAction } from './simplifyBrush/simplifyBrush';
import { smudgeBrushAction } from './smudge/smudgeBrush';
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

/** Bridge, on whole paths and on two selected anchors. */
export const bridgePreset: FeaturePreset = {
  id: 'bridge',
  actions: [bridgeAnchorsAction, bridgePathsAction],
};

/** `trimPath`, which `useTrimTool` binds. */
export const trimPreset: FeaturePreset = { id: 'trim', actions: [trimPathAction] };

/** `extendToMeet`, which `useExtendTool` binds. */
export const extendPreset: FeaturePreset = { id: 'extend', actions: [extendToMeetAction] };

/** `smudgeBrush`, which `useSmudgeBrushTool` binds. */
export const smudgePreset: FeaturePreset = { id: 'smudge', actions: [smudgeBrushAction] };

/** Harmonize curvature. */
export const harmonizePreset: FeaturePreset = { id: 'harmonize', actions: [harmonizeAnchorsAction] };

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

/** Path constraints: their actions, their marks in `style`'s colors, and
 *  every edit of a constrained path finished so they hold. */
export function createConstraintsPreset(style: Partial<ConstraintGlyphStyle> = {}): FeaturePreset {
  return {
    id: 'constraints',
    actions: [constrainAnchorsAction, unconstrainAnchorsAction, deleteConstraintAction],
    pathEdit: [createConstraintsExtension(style)],
  };
}

/** Path constraints with their default colors. */
export const constraintsPreset: FeaturePreset = createConstraintsPreset();

/** Blend, Bend along, and Repeat along, live, and the actions that edit and
 *  expand them. The scene must hold `withPathEffectsRegistry`'s derivations. */
export const pathEffectsPreset: FeaturePreset = {
  id: 'pathEffects',
  actions: [blendAction, bendAlongAction, repeatAlongAction, editPathEffectAction, expandPathEffectAction],
};

/** `expandWarp` and `configureWarp`; the warp tools bring their own drags. */
export const warpPreset: FeaturePreset = {
  id: 'warp',
  actions: [expandWarpAction, configureWarpAction],
};

/** Every preset above, the comb, balance, and constraints with their defaults. */
export const pathTools: FeaturePreset = {
  id: 'pathTools',
  includes: [
    simplifyBrushPreset, handleLocksPreset, bridgePreset, trimPreset, extendPreset, smudgePreset,
    harmonizePreset, curvatureCombPreset, balancePreset, constraintsPreset, pathEffectsPreset, warpPreset,
  ],
};
