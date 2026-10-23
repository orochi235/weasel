/**
 * @weasel-js/routing — binding-to-action routing.
 *
 * The pure half: no React, no DOM. The React seam that pumps browser events
 * into the dispatcher, and the providers that feed it, live behind
 * `@weasel-js/routing/react`.
 *
 * @packageDocumentation
 */

// ─── vocabulary ───────────────────────────────────────────────────────────
// The primitives the routing surface is typed in. Declared here so the
// package stands alone; @weasel-js/core re-exports each from its own path.
export type {
  NodeId, View, Bounds, SelectionApi, SelectionMode, SelectionExtendKey,
  DeviceProfile, DebugSink, HandleKind, HitShape, ViewportGestureKind, ModifierState, ResizeAnchor,
} from './vocabulary';

// ─── dependency schema ────────────────────────────────────────────────────
import type { ActiveToolContextValue } from './interactions/actions/activeToolContext';
import type { ActionTuning } from './interactions/actions/tuning';

/**
 * The dependency schema — the map of dep name → value type that
 * `Action.requires`, `DepRegistry.register`/`get` and `useDepSource` are all
 * keyed on.
 *
 * It declares one entry, `activeTool`, because the value and the action that
 * requires it (`tool.offhand`) are both routing's. Whoever supplies the rest
 * merges them in:
 *
 * ```ts
 * declare module '@weasel-js/routing' {
 *   interface DepSchema { selection: SelectionApi }
 * }
 * ```
 *
 * `@weasel-js/core` merges the kit's own deps this way and re-exports
 * `DepSchema`, so a consumer adds its own against `'@weasel-js/core'`.
 */
export interface DepSchema {
  /** Currently active tool id + hotkey-hold stack. */
  activeTool: ActiveToolContextValue;
  /** The menu host of the `ActionsProvider` in scope. */
  menuHost?: import('./menus/menuHost').MenuHost;
  /** The canvas's dispatch trace, for a dep to record a mode switch into. */
  dispatchTrace?: import('./interactions/dispatcher/dispatchTrace').DispatchTrace;
  /** The keymaps open on the canvas: what a leader opens and a hint reads. */
  keymaps?: import('./keymaps/keymapStack').KeymapStack;
}

/** Every dep name declared by anything that has merged into {@link DepSchema}. */
export type DepName = keyof DepSchema;

// Declared HERE, in the barrel, rather than in a module the barrel re-exports.
// A `declare module` augmentation aimed at a module that only *re-exports* an
// interface declares a fresh one in that module's scope instead of merging, and
// the shadowed alias then poisons every `DepSchema[K]` back down the chain
// (TS2536, reported against routing's own source). Consumers augment
// `'@weasel-js/core'`, core re-exports from here, and that is one hop too many
// unless the declaration sits at the export site.


// ─── action param schema ──────────────────────────────────────────────────
/**
 * The params each action reads, by action id — what types a tuning's
 * `params` and the params on the bindings it adds. Whoever ships an action
 * merges its entry in, as with {@link DepSchema}:
 *
 * ```ts
 * declare module '@weasel-js/core' {
 *   interface ActionParamSchema { simplifyBrush: { radiusPx: number } }
 * }
 * ```
 *
 * Declare an entry as a type literal, not an interface: an interface has no
 * index signature, so it is not a `Record<string, unknown>`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ActionParamSchema {}

/** Tunings keyed by action id: typed by {@link ActionParamSchema} for an id it
 *  declares, `Record<string, unknown>` params for any other. */
export type ActionTunings =
  & { readonly [K in keyof ActionParamSchema]?: ActionTuning<ActionParamSchema[K]> }
  & { readonly [id: string]: ActionTuning | undefined };

// ─── overlay schema ───────────────────────────────────────────────────────
/**
 * What the kernel drawing these tools takes as an overlay. Routing never reads
 * an overlay, so it has no type of its own for one; the kernel merges its type
 * in, the same way and for the same reason as {@link DepSchema}:
 *
 * ```ts
 * declare module '@weasel-js/routing' {
 *   interface OverlaySchema { overlay: RenderLayer<unknown> }
 * }
 * ```
 *
 * `defineTool` defaults its overlay type to it, so a
 * tool it builds fits the kernel's `tools` without naming the parameter.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OverlaySchema {}

/** The overlay type merged into {@link OverlaySchema}; `unknown` when none is. */
export type KernelOverlay = OverlaySchema extends { overlay: infer O } ? O : unknown;

// ─── actions ──────────────────────────────────────────────────────────────
export type {
  Action, ActionDispatch, ActionPresentation, ActionSource, ActionVariant, Carried,
} from './interactions/actions/action';
export { actionItems, actionItemTitle } from './interactions/actions/actionItems';
export { actionSettingsParams, readActionSettings } from './interactions/actions/actionSettings';
export type { ActionSettings, ActionSettingsState } from './interactions/actions/actionSettings';
export type { ActionItem } from './interactions/actions/actionItems';
export { actionShortcuts, keySpecShortcut } from './interactions/actions/actionShortcuts';
export type { ActionShortcut } from './interactions/actions/actionShortcuts';
export { actionsTagged, taggedActionItems, matchActionItem } from './interactions/actions/actionTags';
// Both a const table and the union of its values, under one name.
export { actionCursor, ActionDisabledReason } from './interactions/actions/action';
export type { ActionDisabledReason as ActionDisabledReasonValue, ActionUnavailable } from './interactions/actions/action';
export { actionBindings } from './interactions/actions/binding';
export type { GestureBinding, BoundGesture, BindingSource } from './interactions/actions/binding';
export { evaluateActive, evaluateEnabled } from './interactions/actions/actionEnabled';
export type { ActionEnabledResult } from './interactions/actions/actionEnabled';
export { buildDepsFromRequires } from './interactions/actions/buildDeps';
export { createDepRegistry } from './interactions/actions/depNode';
export type { DepRegistry, DepListing, DepSource } from './interactions/actions/depNode';
export { validateActionId, validateActionDefaultBinding } from './interactions/actions/registry';
export type { ActionsRegistry, ActionEntry, ActionsProp } from './interactions/actions/registry';
export { resolveParams } from './interactions/actions/invoker';
export { overlaysOf } from './interactions/actions/overlay';
export { tuneAction } from './interactions/actions/tuning';
export type { ActionParams, ActionTuning, TunedBinding } from './interactions/actions/tuning';
export { bindingId, overriddenBindings, resolveBindingOverrides } from './interactions/actions/bindingOverrides';
export type { BindingOverrides, ResolvedBindingOverrides } from './interactions/actions/bindingOverrides';
export { roleReader, keysHeld } from './interactions/actions/modifierRoles';
export { modifierStateOf } from './interactions/dispatcher/inputFacts';
export type { ModifierRole, ModifierRoles, RoleKeys, RoleRebinds } from './interactions/actions/modifierRoles';

export type {
  Point2, AffordanceHit, DragSample, InvocationCtx, BindingOpts, ActionDeps,
  OverlayRole, OngoingOverlay, OngoingHandle, ImmediateInvoker, OngoingInvoker, Invoker,
} from './interactions/actions/invoker';
export {
  TOOL_OFFHAND_ID, buildToolOffhandBindings, heldKeySpec, makeToolOffhandAction, offhandKeyFor,
} from './interactions/actions/toolOffhand';
export type { ToolOffhandBindingSpec } from './interactions/actions/toolOffhand';

// ─── dispatcher ───────────────────────────────────────────────────────────
export {
  multiTouchGestureId, pointerGestureId, createDispatcher, createDispatchTrace, createTraceRing,
} from './interactions/dispatcher/dispatcher';
export type {
  DispatchTrace, ModeSwitchLogEntry, TraceLogEntry, TraceRing, DispatcherContext, KeyReach, UiOngoingControl,
  ResolveOnlyResult, ResolvedCandidate, ResolveAllOptions, Dispatcher,
} from './interactions/dispatcher/dispatcher';
export * from './interactions/dispatcher/dispatchRecord';
export * from './interactions/dispatcher/matcher';
export * from './interactions/dispatcher/predicates';
export { createLongPressStore, LONG_PRESS_MS } from './interactions/dispatcher/longPressState';
export type {
  PendingLongPress, LongPressState, LongPressStore, LongPressOptions,
} from './interactions/dispatcher/longPressState';
export { DRAG_THRESHOLD_PX, pastDragThreshold, CONTROL_SELECTOR, isInControlWithin } from '@weasel-js/gestures';
export type { GestureKitSettings } from './kitSettings';
export { openPointerSession } from './interactions/pointerSession';
export { startCarry } from './interactions/carry';
export type { Carry, CarryCallbacks, CarryPayload, CarryPointer, CarryStage } from './interactions/carry';
export type {
  PointerSession, PointerSessionOptions, PointerSessionCallbacks, PointerSessionCancelReason,
} from './interactions/pointerSession';

// ─── eligibility rule algebra ─────────────────────────────────────────────
export * from './eligibility';

// ─── contributions ────────────────────────────────────────────────────────
export type {
  Contribution, ContributionRouting, ContributionChrome, ContributionDeps, Eligibility,
  OverlayPosition, HotkeyTrigger, ToolPresentation,
} from './contributions/types';
export { liveScope } from './contributions/eligibility';
export type { EligibilityState } from './contributions/eligibility';
export { assembleEntries, scopeBindings } from './contributions/assemble';
export type { AssemblyInputs } from './contributions/assemble';
export { mergeContributions } from './contributions/merge';
export { modeShortcuts, modeShortcutSpec } from './contributions/modeShortcuts';
export type { ModeShortcutHandlers } from './contributions/modeShortcuts';
export { captureGesture, captureKey, createKeymapStack, describeKeymap, KEYMAP_HOLD, keymapContribution, keymapLeaderBindingId, keymapLeaderId, keymapShortcuts } from './keymaps';
export type { CaptureGestureOptions, CaptureKeyOptions, CaptureKind, CapturedSpec, KeymapDef, KeymapDescription, KeymapRow, KeymapStack, KeymapUnbound, KeymapVerdict, OpenKeymap } from './keymaps';

// ─── tools ────────────────────────────────────────────────────────────────
export type {
  Tool, AnyTool, ToolModifiers, ToolKeybinding, ToolSlot,
} from './tools/types';
export type { ToolDef } from './tools/routeTypes';
export { defineTool } from './tools/defineTool';
export { toolSet, isToolSet, toolIdsOf, withoutTools, toolSetHas } from './tools/toolSet';
export type { ToolSet, ToolEntry } from './tools/toolSet';
export { isTool } from './tools/types';

// ─── route grammar reflection ─────────────────────────────────────────────
export * from './tools/routing';
export { reportRouteConflicts, type ToolScopes } from './tools/routing/reflection/conflicts';

// ─── input plumbing ───────────────────────────────────────────────────────
export { activatesFocusedControl, focusedControlOwnsKey, historyKey, isEditableTarget, matchesKeyBinding } from './interactions/keyHelpers';
export type { KeyBinding } from './interactions/keyHelpers';
export { BROWSER_RESERVED_CHORDS, browserReservedChord, type ReservedChord } from './interactions/browserReservedKeys';
export { scratchKey, getScratch, setScratch, deleteScratch } from './interactions/scratchKey';
export type { ScratchKey, ScratchStore } from './interactions/scratchKey';
export {
  INGEST_STRING_MIMES, admitIngestMime, itemsFromFiles, itemsFromDataTransfer, itemTypesFromDataTransfer, itemsFromClipboardData,
} from './ingestion/ingestItems';
export type { IngestItem } from '@weasel-js/gestures';
export { clientToCanvas, clientToCanvasRect } from './viewport/clientToCanvas';
export { dlog, dwarn, isDebugEnabled } from './dlog';

// ─── menus ────────────────────────────────────────────────────────────────
export type { MenuDef, MenuWhen, MenuHit, OwnedMenuDef } from './menus/types';
export { mergeMenuDefs, pickMenu } from './menus/pickMenu';
export { resolveMenu, resolveSchemaMenu } from './menus/resolveMenu';
export { createMenuHost } from './menus/menuHost';
export type { MenuHost, MenuOpenRequest, OpenMenu } from './menus/menuHost';
export type { MenuSources } from './menus/resolveMenu';
