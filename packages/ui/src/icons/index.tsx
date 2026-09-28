import { Icon, type IconProps } from './Icon';

export { Icon, isFillable } from './Icon';
export type { IconProps } from './Icon';
export { ICON_FILLS, ICON_GROUPS, ICON_PATHS } from './paths';
export type { FillableIconName, IconName } from './paths';

// Tool glyphs live in @weasel-js/core because core needs them for
// `Tool.presentation.icon` defaults and cannot depend on this package.
// Re-exported here so consumers have one import site for the whole set.
export {
  SelectIcon, LassoIcon, RectIcon, EllipseIcon, ImageIcon, EyedropperIcon,
  LineIcon, ArrowIcon, PolygonIcon, StarIcon, PencilIcon, TextIcon, PenIcon, HandIcon,
  UnknownIcon,
} from '@weasel-js/core';
// The standard edit actions' glyphs live beside those actions in core, for the
// same reason.
export {
  CutIcon, CopyIcon, PasteIcon, DuplicateIcon, GroupIcon, UngroupIcon,
  BringForwardIcon, BringToFrontIcon, SendBackwardIcon, SendToBackIcon, FlipXIcon, FlipYIcon,
  UndoIcon, RedoIcon, DeleteIcon,
  AlignLeftIcon, AlignCenterXIcon, AlignRightIcon, AlignTopIcon, AlignCenterYIcon, AlignBottomIcon,
  DistributeHorizontalIcon, DistributeVerticalIcon,
} from '@weasel-js/core';

/** Clone: a ruled card with a second one tucked behind it. */
export const CloneIcon = (p: IconProps) => <Icon name="clone" {...p} />;
/** Reset: a near-full counterclockwise arc, arrowhead at the top. */
export const ResetIcon = (p: IconProps) => <Icon name="reset" {...p} />;
/** Close: an X. */
export const CloseIcon = (p: IconProps) => <Icon name="close" {...p} />;
/** Export: an arrow pointing down into an open tray. */
export const ExportIcon = (p: IconProps) => <Icon name="export" {...p} />;
/** Zoom in: a magnifier with a plus. */
export const ZoomInIcon = (p: IconProps) => <Icon name="zoomIn" {...p} />;
/** Pan: four arrows out from a hub. */
export const PanIcon = (p: IconProps) => <Icon name="pan" {...p} />;
/** Add: a plus. */
export const AddIcon = (p: IconProps) => <Icon name="add" {...p} />;
/** Light color mode: a sun. */
export const ModeLightIcon = (p: IconProps) => <Icon name="modeLight" {...p} />;
/** Dark color mode: a crescent moon. */
export const ModeDarkIcon = (p: IconProps) => <Icon name="modeDark" {...p} />;
/** Automatic color mode: a four-pointed sparkle. */
export const ModeAutoIcon = (p: IconProps) => <Icon name="modeAuto" {...p} />;
/** Remove: a minus. */
export const RemoveIcon = (p: IconProps) => <Icon name="remove" {...p} />;
/** Sort: three ruled lines beside a downward arrow. */
export const SortIcon = (p: IconProps) => <Icon name="sort" {...p} />;
/** Zoom out: a magnifier with a minus. */
export const ZoomOutIcon = (p: IconProps) => <Icon name="zoomOut" {...p} />;
/** Fit: four corner brackets around a small rect. */
export const FitIcon = (p: IconProps) => <Icon name="fit" {...p} />;
/** Snapshot: a camera. */
export const SnapshotIcon = (p: IconProps) => <Icon name="snapshot" {...p} />;
/** Play: a right-pointing triangle. */
export const PlayIcon = (p: IconProps) => <Icon name="play" {...p} />;
/** Pause: two vertical bars. */
export const PauseIcon = (p: IconProps) => <Icon name="pause" {...p} />;
/** Stop: a rounded square. */
export const StopIcon = (p: IconProps) => <Icon name="stop" {...p} />;
/** Step back: a left-pointing triangle against a bar. */
export const StepBackIcon = (p: IconProps) => <Icon name="stepBack" {...p} />;
/** Step forward: a right-pointing triangle against a bar. */
export const StepForwardIcon = (p: IconProps) => <Icon name="stepForward" {...p} />;
/** @deprecated Use {@link StepForwardIcon}; `step` alone stopped naming a direction. */
export const StepIcon = StepForwardIcon;
/** Crosshair: a ring with four ticks on the axes. */
export const CrosshairIcon = (p: IconProps) => <Icon name="crosshair" {...p} />;
/** Fullscreen: two corner arrows pointing out diagonally. */
export const FullscreenIcon = (p: IconProps) => <Icon name="fullscreen" {...p} />;
/** Compare: a frame split into two columns of lines. */
export const CompareIcon = (p: IconProps) => <Icon name="compare" {...p} />;
/** Filter: a funnel. */
export const FilterIcon = (p: IconProps) => <Icon name="filter" {...p} />;
/** Search: an empty magnifier. */
export const SearchIcon = (p: IconProps) => <Icon name="search" {...p} />;
/** Loupe: a magnifier over a grid of pixels. */
export const LoupeIcon = (p: IconProps) => <Icon name="loupe" {...p} />;
/** Layers: a stack of three sheets. */
export const LayersIcon = (p: IconProps) => <Icon name="layers" {...p} />;
/** Page: a document with a folded corner. */
export const PageIcon = (p: IconProps) => <Icon name="page" {...p} />;
/** Lock: a closed padlock. */
export const LockIcon = (p: IconProps) => <Icon name="lock" {...p} />;
/** Unlock: an open padlock. */
export const UnlockIcon = (p: IconProps) => <Icon name="unlock" {...p} />;
/** Visible: an eye. */
export const VisibleIcon = (p: IconProps) => <Icon name="visible" {...p} />;
/** Hidden: an eye struck through. */
export const HiddenIcon = (p: IconProps) => <Icon name="hidden" {...p} />;
/** Pin: a push pin. */
export const PinIcon = (p: IconProps) => <Icon name="pin" {...p} />;
/** Link: two chain links. */
export const LinkIcon = (p: IconProps) => <Icon name="link" {...p} />;
/** Collapse: two chevrons pointing inward. */
export const CollapseIcon = (p: IconProps) => <Icon name="collapse" {...p} />;
/** Expand: two chevrons pointing outward. */
export const ExpandIcon = (p: IconProps) => <Icon name="expand" {...p} />;
/** Chevron: a downward disclosure mark, centered to spin in place under `rotate()`. */
export const ChevronIcon = (p: IconProps) => <Icon name="chevron" {...p} />;
/** Tune: three slider tracks with their knobs. */
export const TuneIcon = (p: IconProps) => <Icon name="tune" {...p} />;
/** Grid: an outlined 3x3 grid — the grid to snap to. */
export const GridIcon = (p: IconProps) => <Icon name="grid" {...p} />;
/** Snap: a horseshoe magnet. */
export const SnapIcon = (p: IconProps) => <Icon name="snap" {...p} />;
/** Measure: a ruler. */
export const MeasureIcon = (p: IconProps) => <Icon name="measure" {...p} />;
/** Randomize: a die showing three. */
export const RandomizeIcon = (p: IconProps) => <Icon name="randomize" {...p} />;
/** Refresh: two arcs chasing each other around a circle. */
export const RefreshIcon = (p: IconProps) => <Icon name="refresh" {...p} />;
/** Info: an i in a ring. */
export const InfoIcon = (p: IconProps) => <Icon name="info" {...p} />;
/** Warning: an exclamation mark in a triangle. */
export const WarningIcon = (p: IconProps) => <Icon name="warning" {...p} />;
/** Error: an X in a ring. */
export const ErrorIcon = (p: IconProps) => <Icon name="error" {...p} />;
/** Busy: a three-quarter arc, for a spinner. */
export const BusyIcon = (p: IconProps) => <Icon name="busy" {...p} />;
/** Check: a check mark. */
export const CheckIcon = (p: IconProps) => <Icon name="check" {...p} />;
/** Row layout: three filled horizontal bars. */
export const LayoutRowsIcon = (p: IconProps) => <Icon name="layoutRows" {...p} />;
/** Column layout: three filled vertical bars. */
export const LayoutColumnsIcon = (p: IconProps) => <Icon name="layoutColumns" {...p} />;
/** Grid layout: a filled 3x3 of cells. */
export const LayoutGridIcon = (p: IconProps) => <Icon name="layoutGrid" {...p} />;
