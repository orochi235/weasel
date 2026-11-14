// `@weasel-js/ui` ships generic UI primitives plus scene-aware panels
// that stay generic over consumer data (SelectionPanel). App-specific
// policy panels (document props) live in their consuming app.
export * from './components/ActionBar';
export * from './components/ActionButton';
export * from './components/ActionSettings';
export * from './components/Along';
export { type AppearanceAttrs, type AppearanceProps, EMPHASIS_ICONS, type Emphasis, GRADE_ICONS, type Grade, type Stance, useAppearance } from './components/appearance';
export * from './components/Badge';
export * from './components/BandEditor';
export * from './components/Bar';
export * from './components/Button';
export * from './components/Callout';
export * from './components/Checkbox';
export * from './components/CloseButton';
export * from './components/Code';
export * from './components/CodeBlock';
export * from './components/ColorField';
export * from './components/ColorModeControl';
export * from './components/ComboBox';
export * from './components/CommandPalette';
export * from './components/CurveEditor';
export * from './components/DataGrid';
export * from './components/Density';
export * from './components/DetailList';
export * from './components/Dialog';
export * from './components/Disabled';
export * from './components/Disclosure';
export * from './components/DragGhost';
export * from './components/DragGrip';
export * from './components/EasingPicker';
export * from './components/EffectList';
export * from './components/Field';
export * from './components/FillStrokeSwatch';
export * from './components/FitLabel';
export * from './components/FloatingPanel';
export * from './components/FontFamilySelect';
export * from './components/FontWeightSelect';
export * from './components/FpsMeter';
export * from './components/GradientEditor';
export * from './components/HistoryList';
export * from './components/Icon';
export * from './components/InlineMarkdown';
export * from './components/InlineRange';
export * from './components/Input';
export * from './components/inspector/AnchorFields';
export * from './components/inspector/CharacterOptions';
export * from './components/inspector/SelectionPanel';
export * from './components/ItemList';
export * from './components/Jog';
export * from './components/Keycaps';
export * from './components/KeymapHint';
export * from './components/LastOperationPanel';
export * from './components/LayerList';
export * from './components/Legend';
export * from './components/ListEditor';
export type { ListOption } from './components/listOption';
export * from './components/MeasureReadout';
export * from './components/Menu';
export * from './components/MenuBar';
export * from './components/MenuButton';
export * from './components/MeshEditor';
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
export * from './components/NumberField';
export * from './components/OpacityRange';
export * from './components/PageTabs';
export * from './components/PaintField';
export * from './components/PaintInput';
export * from './components/PatternPicker';
export * from './components/Plot2D';
export * from './components/PlotDataPanel';
export * from './components/Popover';
export * from './components/Powerline';
export * from './components/Prefs';
export * from './components/PrefsBar';
export * from './components/Properties';
export * from './components/QuantityText';
export * from './components/RadioGroup';
export * from './components/RecentColors';
export * from './components/ResizeHandle';
export * from './components/Ruler';
export * from './components/Rulers';
export * from './components/Run';
export * from './components/ScaleBar';
export * from './components/Segmented';
export * from './components/Select';
export * from './components/Sequence';
export * from './components/ShortcutSheet';
export * from './components/Sidebar';
export * from './components/SidebarPanel';
export * from './components/Slider';
export { paintGradientTrack } from './components/Slider/paintGradientTrack';
export type { GradientTrackOptions } from './components/Slider/paintGradientTrack';
export * from './components/SwatchGrid';
export * from './components/SwatchStrip';
export * from './components/Switch';
export * from './components/Tabs';
export * from './components/TextArea';
export * from './components/CycleButton';
export * from './components/Timeline';
export * from './components/Toast';
export * from './components/TokenField';
export * from './components/TokenPanel';
export * from './components/ToolbarDock';
export * from './components/ToolGroup';
export * from './components/ToolOptionsBar';
export * from './components/ToolPalette';
export * from './components/ToolRail';
export * from './components/Tooltip';
export * from './components/Transport';
export * from './components/Tree';
export * from './components/ZoomControl';
export { byRank } from './byRank';
export { MIXED_HINT } from './components/Field/mixedHint';
export { dlog, isDebugEnabled } from './dlog';
export { domFocusScope } from './domFocusScope';
export { domMeasureEnv, type DomTarget } from './domMeasureEnv';
export { HANDLE_SIZE_TOKENS, handleHalf, handleSize } from './handles';
export type { HandleSizeToken } from './handles';
export { MARK_GROUP } from './icons.gen';
export { HISTORY_COALESCE_MS, uiKitSettingsSchema } from './kitSettings';
export { nodeText } from './nodeText';
export type { OptionKey } from './optionKey';
export * from './overlays/portalHost';
export { selectionRoving } from './selectionRoving';
export { tiling, tilingRoving } from './tiling';
export type { TileAttrs, TilingProps } from './tiling';
export { useAsyncOptions } from './useAsyncOptions';
export type { AsyncOption, AsyncOptionsResult, UseAsyncOptionsProps } from './useAsyncOptions';
export { I18nProvider, useFieldLocale } from './useFieldLocale';
export { IDLE_SETTLE_MS, useIdleSettle } from './useIdleSettle';
export { heirOf, type FocusRow } from './useRemovedRowFocus';
export { swallowNextClick, useReorderDragList } from './useReorderDragList';
export type {
  ReorderItem,
  UseReorderDragListOptions,
  ReorderDragState,
  ReorderGhost,
  ReorderDragHandlers,
  PressModifiers,
} from './useReorderDragList';
export { rovingTarget, useRovingTabIndex } from './useRovingTabIndex';
export type { RovingDirection, RovingOrientation, RovingTabIndex, UseRovingTabIndexOptions } from './useRovingTabIndex';
export { pickActiveSection, useScrollSpy } from './useScrollSpy';
export type { ScrollSpy, SectionOffset, UseScrollSpyOptions } from './useScrollSpy';
