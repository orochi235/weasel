// The property-panel family and LayerStack live in `@weasel-js/ui` now; labkit
// re-exports them so existing `@weasel-js/labkit` imports keep resolving. Named,
// not `export *` — a star re-export of an external package emits no binding in
// the bundle.
export type {
  CheckboxRowProps,
  ColorRowProps,
  CurveFieldProps,
  CurveMark,
  EffectCardListItem,
  EffectCardListProps,
  EffectCardProps,
  LayerStackItem,
  LayerStackProps,
  NumberRowProps,
  PropertyGroupProps,
  PropertyListPack,
  PropertyListProps,
  PropertyOption,
  PropertyPanelProps,
  PropertyRowLayout,
  PropertyRowProps,
  PropertyRowVariant,
  PropertySpanProps,
  SelectRowProps,
  SliderRowProps,
  SubpanelProps,
  TextRowProps,
  ToggleRowProps,
} from '@weasel-js/ui';
export {
  CheckboxRow,
  ColorRow,
  CurveField,
  EffectCard,
  EffectCardList,
  LayerStack,
  NumberRow,
  PropertyGroup,
  PropertyList,
  PropertyPanel,
  PropertyRow,
  PropertySpan,
  SelectRow,
  SliderRow,
  Subpanel,
  TextRow,
  ToggleRow,
} from '@weasel-js/ui';
export type {
  Annotation,
  AnnotationData,
  AnnotationInit,
  AnnotationKind,
  AnnotationMeaning,
  AnnotationPatch,
  AnnotationQuery,
  AnnotationStatus,
  AnnotationStoreOptions,
  AnnotationsApi,
  AnnotationsCapability,
  AnnotationTarget,
  AnnotationTargetInfo,
  FracPoint,
  FracRect,
  MarkScene,
  SerializedAnnotations,
  WorldRect,
} from './annotations';
export {
  annotationsFromJSON,
  createAnnotationScene,
  createAnnotationStore,
  fracContains,
  fracIntersects,
  fracToWorld,
  isStale,
  roundFrac,
  seenFrom,
  worldToFrac,
} from './annotations';
export type { AnnotationOverlayProps } from './annotations/AnnotationOverlay';
export { AnnotationOverlay } from './annotations/AnnotationOverlay';
export {
  AnnotationsContext,
  useAnnotations,
  useAnnotationsOptional,
} from './annotations/AnnotationsContext';
export type { AnnotationTargetsProps } from './annotations/AnnotationTargets';
export { AnnotationTargets } from './annotations/AnnotationTargets';
export type { MarkListProps } from './annotations/MarkList';
export { MarkList } from './annotations/MarkList';
export type { MarkStyle, PaintableMark } from './annotations/paint';
export { markCommands } from './annotations/paint';
export type { AnnotationToolInfo } from './annotations/toolMap';
export {
  ANNOTATION_TOOLS,
  ANNOTATION_WEASEL_TOOLS,
  annotationToolInfo,
} from './annotations/toolMap';
export type { ContentSize, PaneSize } from './annotations/view';
export { fitView, fromWeaselView, toWeaselView } from './annotations/view';
export type {
  CanvasLayerDescriptor,
  CanvasStackContextValue,
  CanvasStackProps,
  CanvasStackSurface,
  ViewportSize,
  WorldFrame,
  WorldSpec,
  ZoomAtOptions,
} from './canvas';
export {
  applyCamera,
  CanvasStack,
  CanvasStackContext,
  centerOn,
  DEFAULT_FRAME,
  resolveFrame,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './canvas';
export type { OrbitHandlers, OrbitView, UseOrbitOptions, Vec3 } from './canvas/useOrbit';
export {
  clampPitch,
  orbitAfterDrag,
  orbitAfterWheel,
  PITCH_LIMIT,
  useOrbit,
  wrapYaw,
} from './canvas/useOrbit';
export * from './chrome';
export { f } from './config/builder';
export { fromConfigFields } from './config/fromConfigField';
export { resolveConfigSchema } from './config/resolve';
export { applyRules, builtinRules, titleCase } from './config/rules';
export type {
  Annotations,
  ConfigNode,
  ConfigOf,
  ConfigOption,
  ConfigRule,
  ConfigRuleContext,
  ConfigSchema,
  ControlRenderer,
  InferConfig,
  LeafPatch,
  NodeOptions,
  NodeValue,
  ResolvedConfig,
  SectionSpec,
} from './config/types';
export { useConfigSchema } from './config/useConfigSchema';
export { isLeafVisible } from './config/visible';
export { ControlPanel } from './controls/ControlPanel';
export type {
  CheckboxField,
  ColorField,
  ConfigField,
  ConfigFieldBase,
  ConfigFieldType,
  NumberField,
  SelectField,
  SelectOption,
  SliderField,
  TextField,
} from './controls/types';
export { defineInstrument, type InstrumentSpec } from './instrument/defineInstrument';
export type {
  CanvasCapability,
  CanvasLayer,
  DragDropCapability,
  DragFeedback,
  HitResult,
  Instrument,
  InstrumentList,
  LayerCapability,
  LayerDescriptor,
  PaletteItem,
  Point,
  RenderContext,
  SystemEvent,
  UndoCapability,
  ViewTransform,
} from './instrument/types';
export type { ValidationResult } from './instrument/validateConfigSchema';
export { validateConfigSchema } from './instrument/validateConfigSchema';
export * from './job';
export * from './lab';
export type { LayerListProps } from './layers';
export { LayerList } from './layers';
export * from './loupe';
export * from './primitives';
export {
  createMemoryAdapter,
  localStorageAdapter,
  noneAdapter,
  sessionStorageAdapter,
  urlHashAdapter,
} from './state/adapters';
export {
  LabStoreContext,
  LabStoreProvider,
  TrialIdContext,
  TrialIdProvider,
  useLabStore,
  useTrialId,
} from './state/context';
export { CURRENT_DOCUMENT_VERSION, labDocumentKey, quarantineKey } from './state/document';
export type {
  CreateLabStoreOptions,
  LabDocument,
  LabMode,
  LabStoreState,
  SavedSnapshot,
  SerializedTrial,
  StorageAdapter,
  TrialRecord,
  TrialStateHandle,
  UndoStack,
} from './state/types';
export type { UndockedPanel, UndockedPanels } from './state/undock';
export { dockPanel, panelKey, undockPanel } from './state/undock';
export { useTrialState } from './state/useTrialState';
export type { ViewTransform2D } from './state/view';
export { as2DView, DEFAULT_VIEW } from './state/view';
export * from './surface';
export { interstellarTheme } from './theme/interstellar';
export type { ToolCapability, TrialTool } from './tools/types';
export * from './trial';
export type { EventBus, EventListener } from './undo';
export { clearUndo, createEventBus, emptyStack, pushSnapshot, redo, undo } from './undo';
