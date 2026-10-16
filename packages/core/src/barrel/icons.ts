/**
 * Part of the `@weasel-js/core` barrel. Default tool and action icons.
 *
 * @packageDocumentation
 */

// ─── Built-in tool icons ────────────────────────────────────────────────────
// Match the convention used by the Pathfinder panel and WeaselDraw
// action-bar icons. Available to any consumer rendering a tool palette
// today; will back `Tool.presentation.icon` defaults once the
// tool-palette spec ships.
export {
  SelectIcon,
  LassoIcon,
  RectIcon,
  EllipseIcon,
  ImageIcon,
  EyedropperIcon,
  LineIcon,
  ArrowIcon,
  PolygonIcon,
  StarIcon,
  PencilIcon,
  TextIcon,
  PenIcon,
  HandIcon,
  SliceIcon,
  BoneIcon,
  WeightIcon,
  MeasureIcon,
  UnknownIcon,
} from '../icons';
export type { IconProps } from '../icons';

// ─── Default boolean-op (Pathfinder) icons ──────────────────────────────────
// Shipped with `defaultBooleanActions`; re-exported so consumers that need to
// render an op-shaped glyph outside an `<ActionBar>` (e.g. WeaselDraw's
// layer-row "produced by" badge) don't have to author their own SVGs or reach
// into a deep path.
export {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
  CropIcon,
  TrimIcon,
  MergeIcon,
} from '../interactions/actions/defaults/icons/booleanIcons';
export { CreateOutlinesIcon, OutlineStrokeIcon } from '../interactions/actions/defaults/icons/outlineIcons';
export {
  AverageAnchorsIcon, BendSegmentIcon, HarmonizeIcon, HoldHandleAngleIcon, HoldHandleLengthIcon, RetractHandlesIcon, SimplifyBrushIcon,
  SymmetricHandlesIcon,
} from '../interactions/actions/defaults/icons/anchorIcons';
export {
  BridgeIcon, CutAtCrossingsIcon, JoinIcon, OffsetPathIcon, SimplifyIcon,
} from '../interactions/actions/defaults/icons/pathIcons';

// ─── Default edit-action icons ──────────────────────────────────────────────
// Shipped on the clipboard, duplicate, group, reorder and flip actions.
export {
  CutIcon,
  CopyIcon,
  PasteIcon,
  DuplicateIcon,
  TransformAgainIcon,
  GroupIcon,
  UngroupIcon,
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
  FlipXIcon,
  FlipYIcon,
} from '../interactions/actions/defaults/icons/editIcons';

// ─── Default align and distribute icons ─────────────────────────────────────
export {
  AlignLeftIcon,
  AlignCenterXIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignCenterYIcon,
  AlignBottomIcon,
} from '../interactions/actions/defaults/icons/alignIcons';
export {
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
} from '../interactions/actions/defaults/icons/distributeIcons';
// Undo, redo and delete; drawn in @weasel-js/ui's icon pipeline, which emits
// their markup here and re-exports these components.
export {
  UndoIcon,
  RedoIcon,
  DeleteIcon,
  TuneIcon,
  type ActionGlyphProps,
} from '../interactions/actions/defaults/icons/actionGlyphIcons';
export { ACTION_GLYPHS } from '../interactions/actions/defaults/icons/actionGlyphs';
