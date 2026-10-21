/**
 * Part of the `@weasel-js/core` barrel. Renderer types and values a consumer of this barrel names.
 *
 * @packageDocumentation
 */

// ─── Trailing type re-exports ────────────────────────────────────────────────
// Types reachable through the public API but previously only importable via
// deep paths. Consolidated here so consumers can name them from the barrel.
export type {
  DrawCommand,
  PathDrawCommand,
  GroupDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SpritesDrawCommand,
  ShaderDrawCommand,
  ShaderProgramHandle,
  ShaderUniform,
  Effect,
  CompositeOp,
  BlendFactor,
  BlendFactors,
  GlMat3,
  ImageMinification,
  FlattenTolerance,
  SpriteSheet,
  RenderTarget,
} from '@weasel-js/renderer';
// Uniform-grid sprite sheet layout: frame index → `ImageDrawCommand.source`.
export { frameRect } from '@weasel-js/renderer';
// Floats per sprite in a `SpritesDrawCommand.sprites` array — a consumer
// cannot pack one without it.
export { SPRITE_STRIDE } from '@weasel-js/renderer';
// Full-screen effect passes. Here rather than only on the `/renderer` subpath
// because `RenderLayer.effects` is on this barrel, and a consumer typing that
// field should not have to reach past it for the values that go in it.
export { blur, vignette, registerEffect } from '@weasel-js/renderer';
// World-space RenderLayer draw functions wrap their commands in a
// `kind: 'group'` whose transform is `viewToMat3(view)`. Exported here so
// custom layers in consumer code can construct that wrapper without reaching
// into the renderer subpath.
export { viewToMat3 } from '@weasel-js/renderer';

// Drops the commands that cannot reach a screen rectangle — what the scene
// slot's `cull` option runs, for a custom layer to run over its own output.
export { cullDrawCommands, type CullRect } from '@weasel-js/renderer';

// The renderer's 3x3 matrix namespace, operating on `GlMat3` — 9 elements,
// column-major, in doubles; `mat3.toUniform` is the float32 copy a GL uniform
// upload wants. `mat3.toAffine` and `mat3.fromAffine` convert to and from
// `@weasel-js/geom`'s 6-element `Affine`,
// which is what an `SvgGroupNode.transform` already is.
export { mat3 } from '@weasel-js/renderer';

// MSDF font registration — consumers register (family, variant, metrics
// JSON URL, atlas PNG URL) at startup so TextDrawCommand can resolve glyphs.
export { registerFont, warmFonts, type FontVariant, type FontRequest, type RegisterFontOptions } from '@weasel-js/font';

// Canvas-sourced dynamic SDF fonts — render any installed machine font with
// no baked atlas (canvas fillText → distance transform → R8 glyph pages).
// Baked MSDF (registerFont) always wins; this is the fallback tier.
export {
  registerCanvasFont,
  isCanvasFont,
  unregisterCanvasFont,
  refreshCanvasFont,
  subscribeGlyphReady,
} from '@weasel-js/font';

// The CSS font-family that sets DOM text in the face the canvas draws for a
// family — from its registered font file when the canvas draws an atlas.
export { cssFamilyName, cssFontFamily, cssFontFamilyLoading } from '@weasel-js/font';

// Outline text tier — real glyph geometry, tessellated by the path renderer,
// for text above `OUTLINE_MIN_SCREEN_PX` on screen. Exact at any zoom where a
// distance field is a sampling of one, and a glyph becomes an ordinary path
// so it takes gradient and pattern fills. Purely a rendering upgrade:
// advances and line breaking still come from the SDF tier, so text cannot
// reflow when zoom crosses the threshold. `enableLocalFontOutlines` needs a
// user gesture (and Chromium); everything degrades to SDF without it.
export {
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  loadFontOutlines,
  listFontOutlines,
  fontRegistry,
  fontOutlineRegistry,
  enableLocalFontOutlines,
  canQueryLocalFonts,
} from '@weasel-js/font';
export type {
  FontFamilyFaces,
  OutlineFaceInfo,
  OutlineSource,
  OutlineVariant,
  OutlineStatus,
  FontStyle,
  LocalFontOutlinesResult,
  FaceMetrics,
  FaceRuleMetrics,
  FaceScriptMetrics,
} from '@weasel-js/font';
export type { TextureHandle } from '@weasel-js/paint';

// Custom tool cursors. `Tool.cursor`, `Action.cursor`, `Action.activeCursor`
// and `AffordanceRegion.cursor` all take a `CursorSpec`, so the type and the
// baker reach consumers from here rather than through a second import.
// Named, not `export *` — a star re-export of an external package survives
// typecheck and emits no binding in the bundle.
export {
  cursorFor, resolveCursor, resolveCursorTier, bakeCursor, CURSOR_ANGLE_STEPS, CURSOR_MAX_CSS_PX,
} from '@weasel-js/cursor';
export type {
  CursorSpec,
  CursorGlyphSpec,
  CursorGlyphName,
  CursorGlyph,
  ResolvedCursor,
  BakeOptions,
} from '@weasel-js/cursor';
export { createCursorSink, createPaintedCursorState } from '@weasel-js/cursor';
export type {
  CursorSink,
  CursorSinkTarget,
  PaintedCursor,
  PaintedCursorFrame,
  PaintedCursorState,
} from '@weasel-js/cursor';
export { createPaintedCursorLayer, PAINTED_CURSOR_LAYER_ID } from '../canvas/paintedCursorLayer';
export type {
  LayersMap,
  CanvasLayers,
  SceneSlotLayers,
  SelectionOverlaySlotConfig,
  PathEditingOverlaySlotConfig,
  LayerSlotValue,
  StandardSlotConfig,
} from '../canvas/layerSlots';
export type { SceneSlotConfig } from '../canvas/buildSceneLayer';
export type { BuiltinToolId, Feature } from '../canvas/SceneCanvas';
export type {
  BaseFeature, CompositeFeature, FeatureBindingOptions, FeatureEntry, FeaturePreset,
} from '../canvas/SceneCanvas/features';
export { BUILTIN_TOOL_IDS, SCENE_CANVAS_FEATURES, rotateAroundAABBCenter } from '../canvas/SceneCanvas';
export {
  BUILTIN_TOOLS, SELECT_TOOLS, VIEW_TOOLS, SHAPE_TOOLS, DRAW_TOOLS, TYPE_TOOLS, PAGE_TOOLS,
} from '../canvas/SceneCanvas';
export { COMPOSITE_FEATURES, FEATURE_ACTION_IDS, TOOL_DRIVEN_ACTION_IDS } from '../canvas/SceneCanvas/namedPresets';
export { viewPreset } from '../canvas/SceneCanvas/presets/view';
export { selectPreset } from '../canvas/SceneCanvas/presets/select';
export { movePreset, outlinePreset, resizePreset, rotatePreset } from '../canvas/SceneCanvas/presets/transform';
export { editPreset } from '../canvas/SceneCanvas/presets/edit';
export { arrangePreset } from '../canvas/SceneCanvas/presets/arrange';
export { pathsPreset } from '../canvas/SceneCanvas/presets/paths';
export { ingestPreset } from '../canvas/SceneCanvas/presets/ingest';
export { KIT_SHAPE_KINDS, SHAPE_KINDS } from '../core/shapeKinds';
export type {
  BuiltinShapeToolId, KitInsertShape, ShapeKind, ShapeKindDescriptor, ShapeKindsWhere,
} from '../core/shapeKinds';
export type { BuiltinToolOptions } from '../canvas/SceneCanvas/useBuiltinShapeTools';
export type { InsertNodeFactory, InsertPaint, PreviewPathsDep } from '../canvas/deps';
export { paletteInsertPaint, useTransformFollower } from '../canvas/deps';
export type {
  SceneToAdapterOptions,
  SceneAdapterSelection,
} from '../canvas/sceneAdapter';
export type { ContributionRouting, Eligibility, EligibilityState, HotkeyTrigger, OverlayPosition, ToolPresentation } from '@weasel-js/routing';
export type { Contribution, ContributionChrome } from '../tools/overlayBinding';
export type { ContributionDeps } from '@weasel-js/routing';
export { assembleEntries, liveScope, scopeBindings, modeShortcuts, modeShortcutSpec } from '@weasel-js/routing';
export type { AssemblyInputs } from '@weasel-js/routing';
export type { ModeShortcutHandlers } from '@weasel-js/routing';
export { createKeymapStack, keymapContribution, keymapLeaderBindingId, keymapLeaderId } from '@weasel-js/routing';
export type { KeymapDef, KeymapStack, KeymapUnbound, KeymapVerdict, OpenKeymap } from '@weasel-js/routing';
export { bindingSpec, held, key, keySpecRoute, unbound } from '@weasel-js/gestures';
export type { BindingOverrideInput } from '@weasel-js/gestures';
export { mergeContributions } from '../canvas/surfaceContribution';
export type { SurfaceContribution, ContributionDepReader, ContributionFrameCtx } from '../canvas/surfaceContribution';
export { KIT_VERSIONS, checkRequirements, satisfiesRange } from '../canvas/kitRequirements';
export type { KitVersions, KitRequirements, RequirementMismatch } from '../canvas/kitRequirements';
export type { VersionCheck } from '../canvas/SceneCanvas/useContributionRoles';
export type { InsertOverlayStyle } from '../tools/builtin/marquee';
export type { InsertPoint } from '../interactions/gestures/types';
export type {
  AnimateToBoundsOptions,
  ViewAnimationApi,
  ViewAnimationOptions,
  ViewChannel,
} from '../core/viewport/useViewAnimation';
export type {
  UseHandToolOptions,
  InertiaConfig as HandToolInertiaConfig,
} from '../tools/builtin/hand/useHandTool';
// UseWheelPanToolOptions and WheelPanInertiaConfig removed (useWheelPanTool dissolved).
export type { SelectAdapter } from '../tools/builtin/select/useSelectTool';
export type { PolygonPoint } from '../tools/builtin/polygon/usePolygonTool';
export type { StarPoint } from '../tools/builtin/star/useStarTool';
export type { UseSceneTrivialOptions } from '../core/scene/useScene';
export type {
  DefaultTextData,
  UseSceneTextEditReturn,
} from '../features/text/useSceneTextEdit';
export type { EditingDrawOne } from '../features/text/editingDrawOne';
export { textBoxOf, type TextNodeData, type TextOverflow } from '../canvas/nodeShapes/textPainter';
export type { StyleToggle } from '@weasel-js/text-dom';
export type { Vec2 } from '../core/geometry/vec2';
export type { Rect } from '@weasel-js/geom';

// The read-only surface each kit registry hands out (`paintKindRegistry`,
// `markerRegistry`, `fontRegistry`, …), and the store behind it.
export { createReflectable } from '@weasel-js/registry';
export type {
  Reflectable,
  Reflection,
  ReflectedEntry,
  Registrant,
  RegisterOptions,
} from '@weasel-js/registry';
