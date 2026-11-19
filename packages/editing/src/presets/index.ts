/**
 * `@weasel-js/editing/presets`: the kit's feature presets under short names, core's view presets beside
 * editing's, for `<SceneCanvas features>`:
 *
 * ```tsx
 * import * as presets from '@weasel-js/editing/presets';
 * <SceneCanvas features={[presets.view, presets.pick, presets.move, presets.delete]} />
 * ```
 *
 * Each is the same object as its `…Preset` export from `@weasel-js/editing` (or `@weasel-js/core`, for the view
 * presets). Importing this entry loads every preset's actions.
 *
 * @packageDocumentation
 */
export { viewPreset as view, viewToolsPreset as viewTools } from '@weasel-js/core';
export {
  alignPreset as align, arrangePreset as arrange, distributePreset as distribute, flipPreset as flip,
  reorderPreset as reorder,
} from './arrange';
export { booleansPreset as booleans } from './booleans';
export { drawPreset as draw, pickPreset as pick, transformPreset as transform } from './composites';
export {
  clipboardPreset as clipboard, contextMenuPreset as contextMenu, deletePreset as delete,
  duplicatePreset as duplicate, editPreset as edit, escapePreset as escape, groupPreset as group,
  nudgePreset as nudge, selectAllPreset as selectAll, stylePreset as style,
} from './edit';
export { ingestPreset as ingest } from './ingest';
export { insertPreset as insert } from './insert';
export { pathfinderPreset as pathfinder } from './pathfinder';
export { selectPreset as select } from './select';
export { selectionPreset as selection } from './selection';
export { selectionChromePreset as selectionChrome } from './selectionChrome';
export {
  selectToolsOfferedPreset as selectToolsOffered, selectToolsPreset as selectTools,
  shapeToolsOfferedPreset as shapeToolsOffered, shapeToolsPreset as shapeTools,
} from './tools';
export {
  movePreset as move, outlinePreset as outline, resizePreset as resize, rotatePreset as rotate,
} from './transform';
