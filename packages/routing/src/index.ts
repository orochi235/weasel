/**
 * @weasel-js/routing — binding-to-action routing.
 *
 * The pure half: no React, no DOM. The React seam that pumps browser events
 * into the dispatcher, and the providers that feed it, live behind
 * `@weasel-js/routing/react`.
 */

// ─── vocabulary ───────────────────────────────────────────────────────────
// The primitives the routing surface is typed in. Declared here so the
// package stands alone; @weasel-js/core re-exports each from its own path.
export type {
  NodeId, View, Bounds, SelectionApi, SelectionMode, SelectionExtendKey,
  DeviceProfile, DebugSink, HandleKind, HitShape, ModifierState, ResizeAnchor,
} from './vocabulary';

// ─── dependency schema ────────────────────────────────────────────────────
/**
 * The dependency schema — the map of dep name → value type that
 * `Action.requires`, `DepRegistry.register`/`get` and `useDepSource` are all
 * keyed on.
 *
 * It is declared **empty** here on purpose. Routing knows that an action names
 * its dependencies and that the registry resolves them at invocation time; it
 * does not know what a selection, a scene or a viewport is. Whoever supplies
 * those merges them in:
 *
 * ```ts
 * declare module '@weasel-js/routing' {
 *   interface DepSchema { selection: SelectionApi }
 * }
 * ```
 *
 * `@weasel-js/core` merges the kit's own 24 deps this way and re-exports
 * `DepSchema`, so a consumer adds its own against `'@weasel-js/core'` and
 * never has to know this module exists. The merge carries through the
 * re-export in both directions — `scripts/smoke-consumer-bundle.mjs` asserts
 * it against the published `.d.ts`, which is where it once broke: a
 * cross-module augmentation stops merging when `rollup-plugin-dts` flattens
 * both files into one chunk.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DepSchema {}

/** Every dep name declared by anything that has merged into {@link DepSchema}. */
export type DepName = keyof DepSchema;

// Declared HERE, in the barrel, rather than in a module the barrel re-exports.
// A `declare module` augmentation aimed at a module that only *re-exports* an
// interface declares a fresh one in that module's scope instead of merging, and
// the shadowed alias then poisons every `DepSchema[K]` back down the chain
// (TS2536, reported against routing's own source). Consumers augment
// `'@weasel-js/core'`, core re-exports from here, and that is one hop too many
// unless the declaration sits at the export site.


// ─── actions ──────────────────────────────────────────────────────────────
export type {
  Action, ActionDispatch, ActionPresentation, ActionSource, ActionVariant,
} from './interactions/actions/action';
export { actionItems } from './interactions/actions/actionItems';
export type { ActionItem } from './interactions/actions/actionItems';
// Both a const table and the union of its values, under one name.
export { ActionDisabledReason } from './interactions/actions/action';
export type { ActionDisabledReason as ActionDisabledReasonValue } from './interactions/actions/action';
export { actionBindings } from './interactions/actions/binding';
export type { GestureBinding, BoundGesture, BindingSource } from './interactions/actions/binding';
export { evaluateEnabled } from './interactions/actions/actionEnabled';
export type { ActionEnabledResult } from './interactions/actions/actionEnabled';
export { buildDepsFromRequires } from './interactions/actions/buildDeps';
export { validateActionId, validateActionDefaultBinding } from './interactions/actions/registry';
export type { ActionsRegistry, ActionEntry, ActionsProp } from './interactions/actions/registry';
export { resolveParams } from './interactions/actions/invoker';
export type {
  Point2, AffordanceHit, DragSample, InvocationCtx, BindingOpts, ActionDeps,
  OverlayRole, OngoingOverlay, OngoingHandle, ImmediateInvoker, OngoingInvoker, Invoker,
} from './interactions/actions/invoker';
export {
  TOOL_OFFHAND_ID, buildToolOffhandBindings, makeToolOffhandAction, offhandKeyFor,
} from './interactions/actions/toolOffhand';
export type { ToolOffhandBindingSpec } from './interactions/actions/toolOffhand';

// ─── dispatcher ───────────────────────────────────────────────────────────
export * from './interactions/dispatcher/dispatcher';
export * from './interactions/dispatcher/matcher';
export * from './interactions/dispatcher/predicates';
export { openPointerSession } from './interactions/pointerSession';
export type {
  PointerSession, PointerSessionOptions, PointerSessionCallbacks, PointerSessionCancelReason,
} from './interactions/pointerSession';

// ─── eligibility rule algebra ─────────────────────────────────────────────
export * from './eligibility';

// ─── contributions ────────────────────────────────────────────────────────
export type {
  Contribution, ContributionRouting, ContributionChrome, Eligibility,
  OverlayPosition, HotkeyTrigger, ToolPresentation,
} from './contributions/types';
export { liveScope } from './contributions/eligibility';
export type { EligibilityState } from './contributions/eligibility';
export { scopeBindings } from './contributions/assemble';
export { mergeContributions } from './contributions/merge';

// ─── tools ────────────────────────────────────────────────────────────────
export type {
  Tool, AnyTool, AnyToolOf, ToolCtx, ToolBounds, ToolModifiers, ToolKeybinding, ToolSlot,
} from './tools/types';
export type { ToolDef, ViewportToolDef } from './tools/routeTypes';
export { defineTool } from './tools/defineTool';
export { defineViewportTool } from './tools/defineViewportTool';

// ─── route grammar reflection ─────────────────────────────────────────────
export * from './tools/routing';
export { reportRouteConflicts } from './tools/routing/reflection/conflicts';

// ─── input plumbing ───────────────────────────────────────────────────────
export { isEditableTarget, matchesKeyBinding } from './interactions/keyHelpers';
export type { KeyBinding } from './interactions/keyHelpers';
export { scratchKey, getScratch, setScratch, deleteScratch } from './interactions/scratchKey';
export type { ScratchKey, ScratchStore } from './interactions/scratchKey';
export {
  INGEST_STRING_MIMES, itemsFromFiles, itemsFromDataTransfer, itemsFromClipboardData,
} from './ingestion/ingestItems';
export type { IngestItem } from '@weasel-js/gestures';
export { clientToCanvas, clientToCanvasRect } from './viewport/clientToCanvas';
export { dlog } from './dlog';
