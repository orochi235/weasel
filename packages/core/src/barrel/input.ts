/**
 * Part of the `@weasel-js/core` barrel. Pointer, stylus, and key input.
 *
 * @packageDocumentation
 */

// ─── Stylus input: stylus / coalesced events / pressure ─────────────────────
export {
  getStylusData,
  forEachCoalesced,
  pressureToWidth,
} from '../core/stylus/stylus';
export type {
  StylusData,
  PointerSample,
  CoalescedCtx,
  PressureToWidthOptions,
} from '../core/stylus/stylus';
export { usePointerStylus } from '../core/stylus/usePointerStylus';
export type {
  PointerStylusState,
  UsePointerStylusOptions,
} from '../core/stylus/usePointerStylus';

// ─── Keybindings: low-level key → action wiring ─────────────────────────────
export { activatesFocusedControl, focusedControlOwnsKey, historyKey, isEditableTarget, matchesKeyBinding, undoKeyStep } from '@weasel-js/routing';
export type { KeyBinding } from '@weasel-js/routing';

// ─── Key-state poll: which physical keys are down right now ────────────────
export { createKeyState } from '../input/keyState';
export type { KeyState, KeyStateAttachOptions, KeyModifiers } from '../input/keyState';
export { useKeyState } from '../input/useKeyState';
export { useKeyModifiers } from '../input/useKeyModifiers';
export type { UseKeyStateOptions } from '../input/useKeyState';

// ─── Long-press feedback: the pending press as state, and the default ring ──
export { createLongPressStore, LONG_PRESS_MS } from '@weasel-js/routing';
export type { PendingLongPress, LongPressState, LongPressStore, LongPressOptions } from '@weasel-js/routing';
export {
  createLongPressFeedbackContribution, LONG_PRESS_FEEDBACK_ID,
} from '../domains/longPress/longPressFeedback';
export type { LongPressFeedbackOptions } from '../domains/longPress/longPressFeedback';
export {
  buildSceneViewCommands,
  renderSceneToCanvas,
} from '../canvas/sceneViewRender';
export { releaseCanvasRenderer } from '../canvas/canvasRenderer';
export type {
  SceneViewDrawOne, RenderSceneToCanvasArgs, SceneViewLayers, SceneViewCull,
} from '../canvas/sceneViewRender';
export type { PaintOverrides } from '../canvas/paintOverrides';
export { renderSceneToPixels, planPixelRender, createRasterSession, warmRender } from '../canvas/renderSceneToPixels';
export { checkPixelRenderRect } from '../canvas/pixelRenderRect';
export { createLayerSampler, planLayerSample } from '../canvas/layerSample';
export type { LayerSampleArgs, LayerSamplePlan, LayerSampler } from '../canvas/layerSample';
export { scenePickIds, type ScenePickIds } from '../canvas/scenePickIds';
export { commandRasterizer } from '../canvas/commandRasterizer';
export type { CommandRasterizer, RasterRect } from '../canvas/commandRasterizer';
export { renderNeeds } from '../canvas/renderNeeds';
export type { RenderNeeds } from '../canvas/renderNeeds';
export type {
  RenderSceneToPixelsArgs,
  WarmRenderOptions,
  RasterSession,
  RasterSessionOptions,
  RasterRenderArgs,
  RasterImage,
  HeadlessCanvasLike,
  PixelRenderPlan,
} from '../canvas/renderSceneToPixels';
export { renderDebugSnapshot, debugSnapshotArgs } from '../canvas/renderDebugSnapshot';
export type { RenderDebugSnapshotArgs } from '../canvas/renderDebugSnapshot';
export { rasterToPng } from '../canvas/rasterToPng';
export { exportFormatRegistry, exportFormats, exportRegions, registerExportFormat } from '../canvas/export/exportFormats';
export { exportPages, pageRegion } from '../canvas/export/exportPages';
export { exportRegionPng, type ExportRegionPngOptions, type PngExportOptions } from '../canvas/export/regionPng';
export { selectionRegion } from '../canvas/export/selectionRegion';
export { regionRenderArgs, type RegionRenderArgs, type RegionRenderArgsOptions } from '../canvas/export/regionRenderArgs';
export type { ExportFormat, ExportOptions, ExportRegion, ExportScene } from '../canvas/export/exportTypes';

// --- Pointer ambient context ----------------------------------------------
export {
  PointerContextProvider,
  createPointerStore,
  usePointerContext,
  usePointerPosition,
} from '@weasel-js/routing/react';
export type { PointerContextValue, PointerWorldPos } from '@weasel-js/routing/react';
export { PointerProviderIfRoot } from '../canvas/SceneCanvas/PointerProviderIfRoot';
export { usePublishPointer } from '../input/usePublishPointer';
export type { LocatePointer } from '../input/usePublishPointer';
export { ActionsProviderIfRoot } from '../canvas/SceneCanvas/ActionsProviderIfRoot';
export { DepRegistryProviderIfRoot } from '../canvas/SceneCanvas/DepRegistryProviderIfRoot';
