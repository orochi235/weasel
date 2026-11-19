/**
 * `@weasel-js/path-tools/presets`: path-tools' feature presets under short names, for `<SceneCanvas features>`:
 *
 * ```tsx
 * import * as presets from '@weasel-js/editing/presets';
 * import * as pathTools from '@weasel-js/path-tools/presets';
 * <SceneCanvas features={[presets.draw, pathTools.pathTools]} />
 * ```
 *
 * `pathTools.pathTools` brings every family; the rest turn one on at a time. Importing this entry loads every
 * preset's actions.
 *
 * @packageDocumentation
 */
export {
  addExtremesPreset as addExtremes, anchorSelectionPreset as anchorSelection, bridgePreset as bridge,
  constraintsPreset as constraints, curvatureCombPreset as curvatureComb, fairingPreset as fairing,
  filletPreset as fillet, handleLocksPreset as handleLocks, handleSnapPreset as handleSnap, kneadPreset as knead,
  pathEffectsPreset as pathEffects, pathStructurePreset as pathStructure, pathToolsPreset as pathTools,
  poisePreset as poise, reachPreset as reach, resamplePreset as resample, sandPreset as sand,
  segmentTypePreset as segmentType, snipPreset as snip, tugPreset as tug, warpPreset as warp,
} from './featurePresets';
export {
  anchorKeysPreset as anchorKeys, outlinesPreset as outlines, pathCommandsPreset as pathCommands,
  pathEditPreset as pathEdit, pathsPreset as paths,
} from './pathsPreset';
export { spiroPreset as spiro } from './spiro/spiroPreset';
