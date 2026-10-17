import { icon } from '../icons.gen';
import { Icon, type IconProps } from './Icon';

export { Icon, isFillable } from './Icon';
export type { IconProps } from './Icon';
export { actionIcon } from './actionIcon';
export type { ActionIconSource } from './actionIcon';
export { ICON_GROUPS, MARK_ICONS } from './generated/groups';
export type { MarkIconName } from './generated/groups';
export { ICON_FILLS } from './generated/fills';
export type { FillableIconName } from './generated/fills';
export { ICON_PATHS } from './generated/paths';
export type { IconName } from './generated/paths';

// Tool glyphs live in @weasel-js/core because core needs them for
// `Tool.presentation.icon` defaults and cannot depend on this package.
// Re-exported here so consumers have one import site for the whole set.
export {
  SelectIcon, LassoIcon, RectIcon, EllipseIcon, ImageIcon, EyedropperIcon,
  LineIcon, ArrowIcon, PolygonIcon, StarIcon, PencilIcon, TextIcon, PenIcon, HandIcon,
  SliceIcon, MeasureIcon, UnknownIcon,
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
export const CloneIcon = (p: IconProps) => <Icon name={icon('clone')} {...p} />;
/** Reset: a near-full counterclockwise arc, arrowhead at the top. */
export const ResetIcon = (p: IconProps) => <Icon name={icon('reset')} {...p} />;
/** Close: an X. */
export const CloseIcon = (p: IconProps) => <Icon name={icon('close')} {...p} />;
/** Export: an arrow pointing down into an open tray. */
export const ExportIcon = (p: IconProps) => <Icon name={icon('export')} {...p} />;
/** Zoom in: a magnifier with a plus. */
export const ZoomInIcon = (p: IconProps) => <Icon name={icon('zoomIn')} {...p} />;
/** Pan: four arrows out from a hub. */
export const PanIcon = (p: IconProps) => <Icon name={icon('pan')} {...p} />;
/** Add: a plus. */
export const AddIcon = (p: IconProps) => <Icon name={icon('add')} {...p} />;
/** Light color mode: a sun. */
export const ModeLightIcon = (p: IconProps) => <Icon name={icon('modeLight')} {...p} />;
/** Dark color mode: a crescent moon. */
export const ModeDarkIcon = (p: IconProps) => <Icon name={icon('modeDark')} {...p} />;
/** Automatic color mode: a four-pointed sparkle. */
export const ModeAutoIcon = (p: IconProps) => <Icon name={icon('modeAuto')} {...p} />;
/** Remove: a minus. */
export const RemoveIcon = (p: IconProps) => <Icon name={icon('remove')} {...p} />;
/** Sort: three ruled lines beside a downward arrow. */
export const SortIcon = (p: IconProps) => <Icon name={icon('sort')} {...p} />;
/** Zoom out: a magnifier with a minus. */
export const ZoomOutIcon = (p: IconProps) => <Icon name={icon('zoomOut')} {...p} />;
/** Fit: four corner brackets around a small rect. */
export const FitIcon = (p: IconProps) => <Icon name={icon('fit')} {...p} />;
/** Fit, contain: a circle in a wide frame, meeting its top and bottom. */
export const FitContainIcon = (p: IconProps) => <Icon name={icon('fitContain')} {...p} />;
/** Fit, fill: a circle as wide as a frame, running past its top and bottom. */
export const FitFillIcon = (p: IconProps) => <Icon name={icon('fitFill')} {...p} />;
/** Fit, stretch: an ellipse squashed to a wide frame's proportions. */
export const FitStretchIcon = (p: IconProps) => <Icon name={icon('fitStretch')} {...p} />;
/** Snapshot: a camera. */
export const SnapshotIcon = (p: IconProps) => <Icon name={icon('snapshot')} {...p} />;
/** Play: a right-pointing triangle. */
export const PlayIcon = (p: IconProps) => <Icon name={icon('play')} {...p} />;
/** Pause: two vertical bars. */
export const PauseIcon = (p: IconProps) => <Icon name={icon('pause')} {...p} />;
/** Stop: a rounded square. */
export const StopIcon = (p: IconProps) => <Icon name={icon('stop')} {...p} />;
/** Step back: a left-pointing triangle against a bar. */
export const StepBackIcon = (p: IconProps) => <Icon name={icon('stepBack')} {...p} />;
/** Step forward: a right-pointing triangle against a bar. */
export const StepForwardIcon = (p: IconProps) => <Icon name={icon('stepForward')} {...p} />;
/** @deprecated Use {@link StepForwardIcon}; `step` alone stopped naming a direction. */
export const StepIcon = StepForwardIcon;
/** First: a left-pointing chevron against a bar. */
export const FirstIcon = (p: IconProps) => <Icon name={icon('first')} {...p} />;
/** Prev: a left-pointing chevron. */
export const PrevIcon = (p: IconProps) => <Icon name={icon('prev')} {...p} />;
/** Next: a right-pointing chevron. */
export const NextIcon = (p: IconProps) => <Icon name={icon('next')} {...p} />;
/** Last: a right-pointing chevron against a bar. */
export const LastIcon = (p: IconProps) => <Icon name={icon('last')} {...p} />;
/** Arrow left. */
export const ArrowLeftIcon = (p: IconProps) => <Icon name={icon('arrowLeft')} {...p} />;
/** Arrow right. */
export const ArrowRightIcon = (p: IconProps) => <Icon name={icon('arrowRight')} {...p} />;
/** Arrow up. */
export const ArrowUpIcon = (p: IconProps) => <Icon name={icon('arrowUp')} {...p} />;
/** Arrow down. */
export const ArrowDownIcon = (p: IconProps) => <Icon name={icon('arrowDown')} {...p} />;
/** Page prev: two left-pointing chevrons. */
export const PagePrevIcon = (p: IconProps) => <Icon name={icon('pagePrev')} {...p} />;
/** Page next: two right-pointing chevrons. */
export const PageNextIcon = (p: IconProps) => <Icon name={icon('pageNext')} {...p} />;
/** Enter: an arrow into a box. */
export const EnterIcon = (p: IconProps) => <Icon name={icon('enter')} {...p} />;
/** Leave: an arrow out of a box. */
export const LeaveIcon = (p: IconProps) => <Icon name={icon('leave')} {...p} />;
/** Rewind: two left-pointing triangles. */
export const RewindIcon = (p: IconProps) => <Icon name={icon('rewind')} {...p} />;
/** Fast forward: two right-pointing triangles. */
export const FastForwardIcon = (p: IconProps) => <Icon name={icon('fastForward')} {...p} />;
/** Live: a dot against a bar at the right. */
export const LiveIcon = (p: IconProps) => <Icon name={icon('live')} {...p} />;
/** Record: a ringed dot. */
export const RecordIcon = (p: IconProps) => <Icon name={icon('record')} {...p} />;
/** Loop: two arrows chasing each other. */
export const LoopIcon = (p: IconProps) => <Icon name={icon('loop')} {...p} />;
/** Speed: a dial and its needle. */
export const SpeedIcon = (p: IconProps) => <Icon name={icon('speed')} {...p} />;
/** Taller: arrows up and down from a bar. */
export const TallerIcon = (p: IconProps) => <Icon name={icon('taller')} {...p} />;
/** Shorter: arrows down and up onto a bar. */
export const ShorterIcon = (p: IconProps) => <Icon name={icon('shorter')} {...p} />;
/** Wider: arrows left and right from a bar. */
export const WiderIcon = (p: IconProps) => <Icon name={icon('wider')} {...p} />;
/** Narrower: arrows in from both sides onto a bar. */
export const NarrowerIcon = (p: IconProps) => <Icon name={icon('narrower')} {...p} />;
/** Tallest: a two-headed arrow between two stops. */
export const TallestIcon = (p: IconProps) => <Icon name={icon('tallest')} {...p} />;
/** Shortest: arrows in onto two stops with no room between them. */
export const ShortestIcon = (p: IconProps) => <Icon name={icon('shortest')} {...p} />;
/** Dolly in: an arrow up a floor toward the horizon. */
export const DollyInIcon = (p: IconProps) => <Icon name={icon('dollyIn')} {...p} />;
/** Dolly out: an arrow down a floor from the horizon. */
export const DollyOutIcon = (p: IconProps) => <Icon name={icon('dollyOut')} {...p} />;
/** Turn left: a ring around a vertical axis, headed left. */
export const TurnLeftIcon = (p: IconProps) => <Icon name={icon('turnLeft')} {...p} />;
/** Turn right: a ring around a vertical axis, headed right. */
export const TurnRightIcon = (p: IconProps) => <Icon name={icon('turnRight')} {...p} />;
/** Pitch up: a ring around a horizontal axis, headed up. */
export const PitchUpIcon = (p: IconProps) => <Icon name={icon('pitchUp')} {...p} />;
/** Pitch down: a ring around a horizontal axis, headed down. */
export const PitchDownIcon = (p: IconProps) => <Icon name={icon('pitchDown')} {...p} />;
/** Rise: an arrow up off a ground line. */
export const RiseIcon = (p: IconProps) => <Icon name={icon('rise')} {...p} />;
/** Sink: an arrow down onto a ground line. */
export const SinkIcon = (p: IconProps) => <Icon name={icon('sink')} {...p} />;
/** Orbit: a ring with a head, around a dot. */
export const OrbitIcon = (p: IconProps) => <Icon name={icon('orbit')} {...p} />;
/** Home: a house. */
export const HomeIcon = (p: IconProps) => <Icon name={icon('home')} {...p} />;
/** Settings: a gear. */
export const SettingsIcon = (p: IconProps) => <Icon name={icon('settings')} {...p} />;
/** Sidebar: a frame with a pane down its left side. */
export const SidebarIcon = (p: IconProps) => <Icon name={icon('sidebar')} {...p} />;
/** Legend: two swatches, each beside a rule. */
export const LegendIcon = (p: IconProps) => <Icon name={icon('legend')} {...p} />;
/** Keyboard. */
export const KeyboardIcon = (p: IconProps) => <Icon name={icon('keyboard')} {...p} />;
/** Help: a ringed question mark. */
export const HelpIcon = (p: IconProps) => <Icon name={icon('help')} {...p} />;
/** Menu: three rules. */
export const MenuIcon = (p: IconProps) => <Icon name={icon('menu')} {...p} />;
/** External: an arrow out of a box by its corner. */
export const ExternalIcon = (p: IconProps) => <Icon name={icon('external')} {...p} />;
/** Import: an arrow up out of a tray. */
export const ImportIcon = (p: IconProps) => <Icon name={icon('import')} {...p} />;
/** Save: a disk. */
export const SaveIcon = (p: IconProps) => <Icon name={icon('save')} {...p} />;
/** Open: a folder with its front leaning open. */
export const OpenIcon = (p: IconProps) => <Icon name={icon('open')} {...p} />;
/** Crosshair: a ring with four ticks on the axes. */
export const CrosshairIcon = (p: IconProps) => <Icon name={icon('crosshair')} {...p} />;
/** Fullscreen: two corner arrows pointing out diagonally. */
export const FullscreenIcon = (p: IconProps) => <Icon name={icon('fullscreen')} {...p} />;
/** Compare: a frame split into two columns of lines. */
export const CompareIcon = (p: IconProps) => <Icon name={icon('compare')} {...p} />;
/** Filter: a funnel. */
export const FilterIcon = (p: IconProps) => <Icon name={icon('filter')} {...p} />;
/** Search: an empty magnifier. */
export const SearchIcon = (p: IconProps) => <Icon name={icon('search')} {...p} />;
/** Loupe: a magnifier over a grid of pixels. */
export const LoupeIcon = (p: IconProps) => <Icon name={icon('loupe')} {...p} />;
/** Layers: a stack of three sheets. */
export const LayersIcon = (p: IconProps) => <Icon name={icon('layers')} {...p} />;
/** Page: a document with a folded corner. */
export const PageIcon = (p: IconProps) => <Icon name={icon('page')} {...p} />;
/** Lock: a closed padlock. */
export const LockIcon = (p: IconProps) => <Icon name={icon('lock')} {...p} />;
/** Unlock: an open padlock. */
export const UnlockIcon = (p: IconProps) => <Icon name={icon('unlock')} {...p} />;
/** Bolt: a lightning bolt, for what is worked out and not set by hand. */
export const BoltIcon = (p: IconProps) => <Icon name={icon('bolt')} {...p} />;
/** Visible: an eye. */
export const VisibleIcon = (p: IconProps) => <Icon name={icon('visible')} {...p} />;
/** Hidden: an eye struck through. */
export const HiddenIcon = (p: IconProps) => <Icon name={icon('hidden')} {...p} />;
/** Pin: a push pin. */
export const PinIcon = (p: IconProps) => <Icon name={icon('pin')} {...p} />;
/** Link: two chain links. */
export const LinkIcon = (p: IconProps) => <Icon name={icon('link')} {...p} />;
/** Collapse: two chevrons pointing inward. */
export const CollapseIcon = (p: IconProps) => <Icon name={icon('collapse')} {...p} />;
/** Expand: two chevrons pointing outward. */
export const ExpandIcon = (p: IconProps) => <Icon name={icon('expand')} {...p} />;
/** Chevron: a downward disclosure mark, centered to spin in place under `rotate()`. */
export const ChevronIcon = (p: IconProps) => <Icon name={icon('chevron')} {...p} />;
/** Tune: three slider tracks with their knobs. */
export const TuneIcon = (p: IconProps) => <Icon name={icon('core:tune')} {...p} />;
/** Grid: an outlined 3x3 grid — the grid to snap to. */
export const GridIcon = (p: IconProps) => <Icon name={icon('grid')} {...p} />;
/** Snap: a horseshoe magnet. */
export const SnapIcon = (p: IconProps) => <Icon name={icon('snap')} {...p} />;
/** Randomize: a die showing three. */
export const RandomizeIcon = (p: IconProps) => <Icon name={icon('randomize')} {...p} />;
/** Refresh: two arcs chasing each other around a circle. */
export const RefreshIcon = (p: IconProps) => <Icon name={icon('refresh')} {...p} />;
/** Info: an i in a ring. */
export const InfoIcon = (p: IconProps) => <Icon name={icon('info')} {...p} />;
/** Warning: an exclamation mark in a triangle. */
export const WarningIcon = (p: IconProps) => <Icon name={icon('warning')} {...p} />;
/** Error: an X in a ring. */
export const ErrorIcon = (p: IconProps) => <Icon name={icon('error')} {...p} />;
/** Busy: a three-quarter arc, for a spinner. */
export const BusyIcon = (p: IconProps) => <Icon name={icon('busy')} {...p} />;
/** Check: a check mark. */
export const CheckIcon = (p: IconProps) => <Icon name={icon('check')} {...p} />;
/** Row layout: three filled horizontal bars. */
export const LayoutRowsIcon = (p: IconProps) => <Icon name={icon('layoutRows')} {...p} />;
/** Column layout: three filled vertical bars. */
export const LayoutColumnsIcon = (p: IconProps) => <Icon name={icon('layoutColumns')} {...p} />;
/** Grid layout: a filled 3x3 of cells. */
export const LayoutGridIcon = (p: IconProps) => <Icon name={icon('layoutGrid')} {...p} />;
