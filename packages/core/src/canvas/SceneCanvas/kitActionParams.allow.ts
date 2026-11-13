/**
 * The numbers a file defining a bundled action states outside a params leaf, each with why it is not a lever in
 * the last-operation panel. Keyed by the file's path from the repo root, then by the number as written.
 *
 * The reasons fall into a few kinds. A *count* is the structure of the data (a triangle's three corners, a cubic's
 * six coordinates). A *reach* or a *threshold* is how near a press must land or how far it must travel before an
 * action takes it, which is a kit setting or a hook option and not a result anyone tunes per run (2026-11-13,
 * round twenty-two). A *view* number moves the view, the camera or a lens, which commits nothing to the history,
 * so no last-operation panel ever holds it. A *gesture* number turns pointer travel into a change while a drag
 * runs. A *sample* number is how finely a gesture is measured.
 */
const RADIX = 'parseInt radix';

export const ACTION_LITERALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'packages/core/src/domains/measure/measureGestures.ts': { 6: 'reach: how near a press must land to a measurement' },
  'packages/core/src/interactions/actions/defaults/anchorEditing.ts': { 10: 'reach: the `targets.anchorClickPx` kit setting\'s default' },
  'packages/core/src/interactions/actions/defaults/viewportZoom.ts': { 1.25: 'view: the zoom keys\' step, chosen by the variant' },
  'packages/core/src/interactions/actions/distribute/action.tsx': { 3: 'count: the fewest nodes there is a between to distribute' },
  'packages/core/src/interactions/actions/edit-anchors/action.ts': { 10: RADIX },
  'packages/core/src/interactions/actions/insert/action.ts': { 8: 'threshold: how far a press travels before an insert drags out a size' },
  'packages/core/src/interactions/actions/insert/rotateAction.ts': { 720: 'gesture: radians a pixel of travel turns a shape mid-insert' },
  'packages/core/src/interactions/actions/lasso-select/action.ts': { 3: 'count: the fewest points that enclose an area' },
  'packages/core/src/interactions/actions/pathCommands/cutJoin.ts': {
    6: 'count: the coordinates a cubic command carries', 4: 'count: the coordinates a quadratic command carries',
  },
  'packages/core/src/tools/builtin/pen/usePenTool.ts': { 3: 'count: the fewest anchors a closed subpath has' },
  'packages/core/src/tools/builtin/slice/useSliceTool.ts': {
    3: 'count: the fewest points a closed cut has', 8: 'reach: the `targets.sliceCloseHitPx` kit setting\'s default',
  },
  'packages/diagram/src/edgeLabel.ts': {
    12: 'the font size an edge label is set in where its data names none, not an action\'s',
    4: 'where an end label sits from its end where its data names none, not an action\'s',
  },
  'packages/diagram/src/offPage/follow.ts': { 24: 'view: the margin left around the page the view goes to' },
  'packages/diagram/src/reorder.ts': { 24: 'gesture: how far past the last item a drop slot reaches' },
  'packages/diagram/src/sequence/authorActions.ts': { 20: 'reach: how near a lifeline a note click lands over it' },
  'packages/diagram/src/waypointAction.ts': { 6: 'reach: how near a guide a dragged waypoint snaps, a factory option' },
  'packages/forge/src/shell/loupe/CompareMenu.tsx': { 3: 'the device pixel ratios forge compares a story at, a menu\'s choices' },
  'packages/kernel3d/src/tools.ts': { 0.006: 'view: radians of orbit per pixel dragged', 0.0015: 'view: dolly per pixel dragged' },
  'packages/labkit/src/canvas/CameraInput.tsx': {
    0.1: 'view: the camera\'s zoom floor, a prop default', 32: 'view: the camera\'s zoom ceiling, a prop default',
    '1e-9': 'view: an unclamped zoom\'s floor, above zero',
  },
  'packages/labkit/src/lab/LabZoom.tsx': { '1e-9': 'view: an unclamped zoom\'s floor and the slack its ends are read with', 16: 'the zoom buttons\' icon size' },
  'packages/labkit/src/loupe/lens/compare.ts': {
    4: 'reach: how near the compare seam a press grabs it', 0.05: 'view: the seam\'s nearest approach to the lens\'s left',
    0.95: 'view: the seam\'s nearest approach to the lens\'s right',
  },
  'packages/labkit/src/loupe/lens/lensActionDefs.ts': {
    8: 'count: the most lenses a lab holds', 64: 'view: the lens\'s greatest magnification',
    0.5: 'view: a zoom-out step halves the magnification, chosen by the action',
  },
  'packages/loupe/src/actions.ts': { 0.002: 'view: magnification per wheel delta' },
  'packages/path-tools/src/balance/handleBalance.ts': { 10: RADIX },
  'packages/path-tools/src/constraints/anchorConstraints.ts': {
    3: 'count: the anchors a two-segment constraint takes', 4: 'count: the anchors a two-segment constraint takes, unshared',
  },
  'packages/path-tools/src/constraints/linkAnchor.ts': { 10: RADIX },
  'packages/path-tools/src/cornerShape/editCorner.ts': { 10: RADIX },
  'packages/path-tools/src/lengthen/lengthenPath.ts': { 8: 'reach: how near an open end a press takes it', 10: RADIX },
  'packages/path-tools/src/pathEffects/spine.ts': { 3: 'count: a blend with a spine has three sources' },
  'packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts': { '1e-9': 'a floor that keeps a zero scale from dividing' },
  'packages/path-tools/src/spiro/useSpiroTool.ts': { 3: 'count: the fewest points a closed spiro has' },
  'packages/rig/src/weight/weightActions.ts': { 1.25: 'the brush size keys\' step, a tool option step' },
  'packages/routing/src/interactions/actions/tuning.ts': { 3: 'the position of `enabled`\'s params argument' },
  'packages/routing/src/interactions/sweep/sweep.ts': {
    4: 'sample: the screen px a sweep steps between the controls it passes',
    4096: 'sample: the most steps one sweep move takes',
  },
  'packages/routing/src/tools/toolOptionSteps.ts': {
    60: 'gesture: wheel travel per tool-option step', 1000: 'sample: the most steps one wheel burst takes',
    150: 'gesture: the gap that ends a wheel burst, in ms',
  },
  'apps/draw/src/opacityScrub/useOpacityScrub.ts': {
    0.05: 'gesture: opacity per scrub step', 0.01: 'gesture: opacity per fine scrub step',
    100: 'opacity shown as a percentage',
  },
};
