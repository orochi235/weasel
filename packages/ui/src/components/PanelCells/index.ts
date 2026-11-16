// A panel of prefs sections over a set of records: what `SelectionPanel` in
// `@weasel-js/ui-canvas` draws over scene nodes, and the cells a bar draws.
export type { LeafContext, LeafRenderer, PanelInherit } from '../PrefsSource/types';
export {
  MIXED,
  effectiveSections,
  isPanelSection,
  kindBreakdown,
  nodeLeafValue,
  panelLeafKey,
  panelRowsOf,
  setAtPath,
  sharedValue,
  type Mixed,
  type PanelItem,
  type PanelLeaf,
  type PanelPaintAbove,
  type PanelRecord,
  type PanelRow,
  type PanelSchemaEntry,
  type PanelSection,
  type PanelShown,
} from './model';
export { conditionedSections, selectionJudge } from './conditions';
export { panelSource, type LeafWrites, type PanelSourceInput } from './panelSource';
export { panelSections } from './panelSections';
export type { PanelCellScope } from './panelCells';
export { PanelMarksContext, panelMarkedPaths, type PanelMarks } from './selection';
export { boundAt, leafAcross } from './nodeBounds';
export { nestedPaintValue } from '../Prefs/leafField';
