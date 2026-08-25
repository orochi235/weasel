import { Icon, type IconProps } from './Icon';

export { Icon } from './Icon';
export type { IconProps } from './Icon';
export { ICON_PATHS } from './paths';
export type { IconName } from './paths';

// Tool glyphs live in @weasel-js/core because core needs them for
// `Tool.presentation.icon` defaults and cannot depend on this package.
// Re-exported here so consumers have one import site for the whole set.
export {
  SelectIcon, LassoIcon, RectIcon, EllipseIcon, ImageIcon, EyedropperIcon,
  LineIcon, PolygonIcon, StarIcon, PencilIcon, TextIcon, PenIcon, HandIcon,
  UnknownIcon,
} from '@weasel-js/core';

export const CloneIcon = (p: IconProps) => <Icon name="clone" {...p} />;
export const ResetIcon = (p: IconProps) => <Icon name="reset" {...p} />;
export const CloseIcon = (p: IconProps) => <Icon name="close" {...p} />;
export const ExportIcon = (p: IconProps) => <Icon name="export" {...p} />;
export const ZoomInIcon = (p: IconProps) => <Icon name="zoomIn" {...p} />;
export const PanIcon = (p: IconProps) => <Icon name="pan" {...p} />;
export const AddIcon = (p: IconProps) => <Icon name="add" {...p} />;
export const RemoveIcon = (p: IconProps) => <Icon name="remove" {...p} />;
export const DeleteIcon = (p: IconProps) => <Icon name="delete" {...p} />;
export const SortIcon = (p: IconProps) => <Icon name="sort" {...p} />;
export const UndoIcon = (p: IconProps) => <Icon name="undo" {...p} />;
export const RedoIcon = (p: IconProps) => <Icon name="redo" {...p} />;
export const ZoomOutIcon = (p: IconProps) => <Icon name="zoomOut" {...p} />;
export const FitIcon = (p: IconProps) => <Icon name="fit" {...p} />;
export const SnapshotIcon = (p: IconProps) => <Icon name="snapshot" {...p} />;
export const PlayIcon = (p: IconProps) => <Icon name="play" {...p} />;
export const PauseIcon = (p: IconProps) => <Icon name="pause" {...p} />;
export const StopIcon = (p: IconProps) => <Icon name="stop" {...p} />;
export const StepIcon = (p: IconProps) => <Icon name="step" {...p} />;
export const CrosshairIcon = (p: IconProps) => <Icon name="crosshair" {...p} />;
export const FullscreenIcon = (p: IconProps) => <Icon name="fullscreen" {...p} />;
export const CompareIcon = (p: IconProps) => <Icon name="compare" {...p} />;
export const FilterIcon = (p: IconProps) => <Icon name="filter" {...p} />;
export const SearchIcon = (p: IconProps) => <Icon name="search" {...p} />;
export const LayersIcon = (p: IconProps) => <Icon name="layers" {...p} />;
export const LockIcon = (p: IconProps) => <Icon name="lock" {...p} />;
export const UnlockIcon = (p: IconProps) => <Icon name="unlock" {...p} />;
export const VisibleIcon = (p: IconProps) => <Icon name="visible" {...p} />;
export const HiddenIcon = (p: IconProps) => <Icon name="hidden" {...p} />;
export const PinIcon = (p: IconProps) => <Icon name="pin" {...p} />;
export const LinkIcon = (p: IconProps) => <Icon name="link" {...p} />;
export const CollapseIcon = (p: IconProps) => <Icon name="collapse" {...p} />;
export const ExpandIcon = (p: IconProps) => <Icon name="expand" {...p} />;
export const TuneIcon = (p: IconProps) => <Icon name="tune" {...p} />;
export const GridIcon = (p: IconProps) => <Icon name="grid" {...p} />;
export const SnapIcon = (p: IconProps) => <Icon name="snap" {...p} />;
export const MeasureIcon = (p: IconProps) => <Icon name="measure" {...p} />;
export const RandomizeIcon = (p: IconProps) => <Icon name="randomize" {...p} />;
export const RefreshIcon = (p: IconProps) => <Icon name="refresh" {...p} />;
export const InfoIcon = (p: IconProps) => <Icon name="info" {...p} />;
export const WarningIcon = (p: IconProps) => <Icon name="warning" {...p} />;
export const ErrorIcon = (p: IconProps) => <Icon name="error" {...p} />;
export const BusyIcon = (p: IconProps) => <Icon name="busy" {...p} />;
