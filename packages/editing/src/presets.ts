/**
 * `@weasel-js/editing/presets`: the kit's feature presets under short names, core's view presets beside
 * editing's, for `<SceneCanvas features>`:
 *
 * ```tsx
 * import * as presets from '@weasel-js/editing/presets';
 * <SceneCanvas features={[presets.view, presets.pick, presets.move, presets.delete]} />
 * ```
 *
 * The view presets are the same objects as `@weasel-js/core/presets` exports. Importing this entry loads every
 * preset's actions.
 *
 * @packageDocumentation
 */
export { view, viewTools } from '@weasel-js/core/presets';
export {
  alignPreset as align, arrangePreset as arrange, distributePreset as distribute, flipPreset as flip,
  reorderPreset as reorder, swapPreset as swap,
} from './presets/arrange';
export { booleansPreset as booleans } from './presets/booleans';
export { drawPreset as draw, pickPreset as pick, transformPreset as transform } from './presets/composites';
export {
  clipboardPreset as clipboard, contextMenuPreset as contextMenu, deletePreset as delete,
  duplicatePreset as duplicate, editPreset as edit, escapePreset as escape, groupPreset as group,
  nudgePreset as nudge, selectAllPreset as selectAll, stylePreset as style,
} from './presets/edit';
export { ingestPreset as ingest } from './presets/ingest';
export { insertPreset as insert } from './presets/insert';
export { pathfinderPreset as pathfinder } from './presets/pathfinder';
export { selectPreset as select } from './presets/select';
export { selectionPreset as selection } from './presets/selection';
export { selectionChromePreset as selectionChrome } from './presets/selectionChrome';
export {
  selectToolsOfferedPreset as selectToolsOffered, selectToolsPreset as selectTools,
  shapeToolsOfferedPreset as shapeToolsOffered, shapeToolsPreset as shapeTools,
} from './presets/tools';
export {
  movePreset as move, outlinePreset as outline, resizePreset as resize, rotatePreset as rotate,
} from './presets/transform';
