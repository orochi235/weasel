// `@weasel-js/ui` ships generic UI primitives plus scene-aware panels
// that stay generic over consumer data (SelectionPanel). App-specific
// policy panels (document props) live in their consuming app.
export { dlog, isDebugEnabled } from './dlog';
export * from './icons';
export { solidColorOf, strokeColorOf } from './components/paintValue';
export * from './components/ActionBar';
export * from './components/Badge';
export * from './components/Button';
export * from './components/CloseButton';
export * from './components/Code';
export * from './components/InlineMarkdown';
export * from './components/CodeBlock';
export * from './components/DataGrid';
export * from './components/AnchorFields';
export * from './components/DetailList';
export * from './components/Disclosure';
export * from './components/DragGhost';
export * from './components/DragGrip';
export * from './components/Keycaps';
export * from './components/LayerList';
export * from './components/MeasureReadout';
export * from './components/KeymapHint';
export * from './components/Slider';
export * from './components/Along';
export * from './components/ItemList';
export * from './components/ListEditor';
export * from './components/segmentedVariant';
export * from './components/ToggleBar';
export * from './components/FitLabel';
export * from './components/ColorModeControl';
export * from './components/ThemeSwitcher';
export * from './components/OptionsBar';
export * from './components/ButtonBar';
export * from './components/ToolOptionsBar';
export * from './components/CharacterOptions';
export * from './components/Bar';
export * from './components/Toolbar';
export * from './components/ToolbarDock';
export * from './components/PaintInput';
export * from './components/PaintField';
export * from './components/FillStrokeSwatch';
export * from './components/SwatchGrid';
export * from './components/SwatchStrip';
export * from './components/RecentColors';
export * from './components/MeshEditor';
export * from './components/PatternPicker';
export * from './components/Powerline';
export * from './components/GestureRoute';
export * from './components/FallthroughDiagram';
export * from './components/Prefs';
export * from './components/PrefConditionEditor';
export * from './components/PrefSchemaEditor';
export * from './components/Properties';
// The factories' bare names (`rule`, `tab`, …) are too generic for the root barrel; they come
// from `@weasel-js/ui/components/MotifFrame`, and here only as `motifs.rule`.
export {
  DefaultMotif,
  type DefaultMotifProps,
  type FrameAttrs,
  type FrameKind,
  type FrameParts,
  type HeadingLevel,
  type HeadingParts,
  type Motif,
  MotifFrame,
  type MotifFrameProps,
  type NotchParams,
  type PlaqueParams,
  type RootProps,
  type StereoParams,
  type TabParams,
  type WellParams,
  withMotifClass,
} from './components/MotifFrame';
export * as motifs from './components/MotifFrame/motifs';
export { type AppearanceAttrs, type AppearanceProps, EMPHASIS_ICONS, type Emphasis, GRADE_ICONS, type Grade, type Stance, useAppearance } from './components/appearance';
export type { SegmentTooltipFields } from './components/segmentTooltip';
export * from './components/SelectionPanel';
export * from './components/ResizeHandle';
export * from './components/Sidebar';
export * from './components/SidebarPanel';
export * from './components/StatusBar';
export * from './components/ToolButton';
export * from './components/ToolGroup';
export * from './components/ToolPalette';
export * from './components/FontFamilySelect';
export * from './components/FontWeightSelect';
export * from './components/Field';
export * from './components/Input';
export * from './components/TextArea';
export * from './components/Checkbox';
export * from './components/Switch';
export * from './components/Tabs';
export * from './components/PageTabs';
export * from './components/QuantityText';
export * from './components/Tree';
export * from './components/RadioGroup';
export * from './components/NumberField';
export * from './components/Select';
export * from './components/MenuButton';
export * from './components/MenuBar';
export * from './components/ContextMenu';
export * from './components/ComboBox';
export * from './components/RangeSlider';
export * from './components/DetentSlider';
export * from './components/InlineRange';
export * from './overlays/portalHost';
export * from './components/Dialog';
export * from './components/Tooltip';
export * from './components/Callout';
export * from './components/Popover';
export * from './components/Toast';
export * from './components/Plot2D';
export * from './components/CurveEditor';
export * from './components/PointPlotter';
export * from './components/ColorField';
export * from './components/CommandPalette';
export * from './components/TokenPanel';
export * from './components/TokenField';
export * from './components/GradientEditor';
export * from './components/BandEditor';
export * from './components/Jog';
export * from './components/Timeline';
export { paintGradientTrack } from './paintGradientTrack';
export type { GradientTrackOpts } from './paintGradientTrack';
export { paintPreviewCss } from './paintPreview';
export { oklchToHex, chromaAt } from './color/oklch';
export type { ChromaCurve, ChromaCurvePoint } from './color/oklch';
export { rampColor, colorRamp } from './color/ramp';
export type { ColorRampOptions } from './color/ramp';
export { useAsyncOptions } from './useAsyncOptions';
export type { OptionKey } from './optionKey';
export type { AsyncOption, AsyncOptionsResult, UseAsyncOptionsProps } from './useAsyncOptions';
export * from './floating';
export { useReorderDragList } from './useReorderDragList';
export { pickActiveSection, useScrollSpy } from './useScrollSpy';
export type { ScrollSpy, SectionOffset, UseScrollSpyOptions } from './useScrollSpy';
export { rovingGridTarget, rovingTarget, useRovingTabIndex } from './useRovingTabIndex';
export type { RovingDirection, RovingOrientation, RovingTabIndex, UseRovingTabIndexOptions } from './useRovingTabIndex';
export { domFocusScope } from './domFocusScope';
export type {
  ReorderItem,
  UseReorderDragListOptions,
  ReorderDragState,
  ReorderGhost,
  ReorderDragHandlers,
  PressModifiers,
} from './useReorderDragList';
export { HANDLE_SIZE_TOKENS, handleHalf, handleSize } from './handles';
export type { HandleSizeToken } from './handles';
export { uiKitSettingsSchema } from './kitSettings';
