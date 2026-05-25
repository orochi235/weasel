import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  defaultNodeRouting,
  useActionsRegistry,
  useScene,
  type GestureSpec,
  type ModSpec,
  type NodeRoutingEntry,
  type TargetSpec,
  type ToolsApi,
} from '@orochi235/weasel';
import type { PhaseSpec } from '@orochi235/weasel-gestures';
import { buildActionRegistry, formatRoute, type RegistryEntry } from '@orochi235/weasel/routing';
import type {
  GestureName,
  ParsedModifiers,
  PhaseAtom,
  ToolDef,
} from '@orochi235/weasel/routing';
import { isValidElement, type ReactNode } from 'react';
import type { PhaseSummary, ToolEntry, ActionEntry, CallbackRef, CallbackSource } from './registryData';
import { formatShortcutParts } from '@orochi235/weasel-ui';
import s from './RegistryInspector.module.css';

export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
  readonly routing: readonly NodeRoutingEntry[];
}

interface ProbeProps {
  onSnapshot(s: RegistrySnapshot): void;
}

interface ShapeData { fill: string }
interface ShapePose { x: number; y: number; width: number; height: number }

/** Mounts a hidden SceneCanvas with the exhaustive tool bundle and lets the
 *  canvas auto-wire its built-in actions (delete / undoRedo / nudge / escape
 *  / selectAll / clipboard / etc.) into the surrounding `ActionsProvider`.
 *  Calls `onSnapshot` with the resulting tool/action lists on every change.
 *
 *  Hidden but kept in the layout tree so the hooks remain alive across
 *  re-renders of the inspector UI. */
export function RegistryProbe({ onSnapshot }: ProbeProps) {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  // `onToolsCreated` fires every render because `useTools` synthesizes a new
  // ToolsApi object literal each render. Track only the structural signature
  // (registry tool ids) — that's all this probe needs — to avoid a render
  // loop. Identity-tracking via plain useState would loop forever.
  const [toolsRegistrySig, setToolsRegistrySig] = useState<string>('');
  const toolsRef = useRef<ToolsApi | null>(null);
  const handleToolsCreated = (api: ToolsApi) => {
    toolsRef.current = api;
    const sig = Object.keys(api.registry).sort().join(',');
    setToolsRegistrySig((prev) => (prev === sig ? prev : sig));
  };
  const tools = toolsRef.current;
  const reg = useActionsRegistry();

  // `reg.list()` returns a new array each call, but the registry itself is a
  // stable context value — and re-rendering when tools change is enough to
  // refresh the action list (action registration fires in effects that run
  // after the initial render).
  const actionsList = reg ? reg.list() : [];

  // Stable signature of registered action ids; used to gate memoization of
  // the tool-entries derivation so binding-route citations refresh exactly
  // when the action set changes (action object identity is unstable). */
  const actionsSig = actionsList.map((a) => a.id).sort().join(',');
  const actionsByID = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const a of actionsList) m.set(a.id, a);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsSig]);

  const toolEntries: readonly ToolEntry[] = useMemo(() => {
    if (!tools) return [];
    void toolsRegistrySig;
    // Union of registry (active/hotkey) + ambient slots — both groups are
    // built-in tools the canvas mounted. Ambient holds resize / rotate /
    // wheel-zoom etc., so omitting them misses ~3 tools per bundle.
    type Slot = { id: string; def?: unknown; cursor?: unknown };
    const tagged: Array<{ slot: 'registry' | 'ambient'; t: Slot }> = [
      ...Object.values(tools.registry).map((t) => ({ slot: 'registry' as const, t })),
      ...tools.ambient.map((t) => ({ slot: 'ambient' as const, t })),
    ];
    const seen = new Set<string>();
    return tagged
      .filter(({ t }) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .map(({ slot, t }): ToolEntry => {
        const def = t.def as ToolDef<unknown> | undefined;
        const routeInfo = def ? collectToolRoutes(def) : { routes: [], bindingActionByRoute: {} };
        const routes = routeInfo.routes;
        const initial = def ? summarizePhase(def.initial) : EMPTY_PHASE;
        const engaged = def?.engaged ? summarizePhase(def.engaged) : undefined;
        const phaseTableCallbacks = def ? collectToolCallbacks(def) : [];
        const bindingCallbacks = synthBindingCallbacks(routeInfo.bindingActionByRoute, actionsByID);
        return {
          kind: 'tool',
          id: t.id,
          label: def?.presentation?.label ?? t.id,
          // hookName lives on the def (reflection escape hatch). Each
          // builtin hook sets `hookName: 'useFooTool'` on its `defineTool`
          // spec; the inspector reads it off the def — no parallel map.
          hookName: def?.hookName,
          cursor: typeof t.cursor === 'string' ? t.cursor : undefined,
          routes,
          slot,
          switchShortcutParts: formatShortcutParts(def?.keybinding),
          hotkey: def?.hotkey,
          presentation: def?.presentation ? {
            label: def.presentation.label,
            group: def.presentation.group,
            shortcut: def.presentation.shortcut,
            icon: renderPresentationIcon(def.presentation.icon),
          } : undefined,
          phases: { initial, engaged },
          capabilities: {
            initScratch: !!def?.initScratch,
            onActivate: !!def?.onActivate,
            onDeactivate: !!def?.onDeactivate,
            hitOverride: !!def?.hitOverride,
          },
          callbacks: [...phaseTableCallbacks, ...bindingCallbacks],
        };
      });
    // `actionsByID` is derived from actionsList; we re-enter the memo when
    // its signature changes (actionsSig) so binding-route citations refresh
    // as actions register.
  }, [tools, toolsRegistrySig, actionsByID]);

  const actionEntries: readonly ActionEntry[] = actionsList.map((a): ActionEntry => ({
    kind: 'action',
    id: a.id,
    label: a.label ?? a.id,
    // Phase 14e Task 7: Action.defaultBinding removed; bindings live on
    // defaultBinding. formatShortcutParts only consumes the legacy shape,
    // so we pass undefined for now (TODO: defaultBinding-aware formatter).
    shortcutParts: formatShortcutParts(undefined),
    shortcut: a.shortcut,
    group: a.group,
    icon: renderPresentationIcon(a.icon),
    enabled: snapshotEnabled(a.enabled),
    callbacks: collectActionCallbacks(a),
    defaultBinding: a.defaultBinding,
  }));

  const lastRef = useRef<string>('');
  useEffect(() => {
    const sig = JSON.stringify({
      t: toolEntries.map((t) => t.id),
      a: actionEntries.map((a) => a.id),
    });
    if (sig === lastRef.current) return;
    lastRef.current = sig;
    onSnapshot({ tools: toolEntries, actions: actionEntries, routing: defaultNodeRouting });
  });

  return (
    <div aria-hidden="true" className={s.hidden}>
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        toolBundle="exhaustive"
        routing={defaultNodeRouting}
        onToolsCreated={handleToolsCreated}
      />
    </div>
  );
}

function formatRoutes(entries: readonly RegistryEntry[]): readonly string[] {
  return entries.map((e) => formatRoute({
    // Probe entries carry tool phases ('initial' | 'engaged') as bare
    // strings; wrap into a `&`-channel atom so the new grammar shape
    // round-trips to the same `[initial]` / `[engaged]` shorthand.
    phases: [{ channel: '&', phase: e.phase }],
    gesture: e.gesture,
    arg: e.arg,
    target: e.target,
    modifiers: e.modifiers,
  }));
}

interface CollectedRoutes {
  /** Formatted route strings, de-duped, source order: phase-table first,
   *  then binding-sourced. */
  routes: readonly string[];
  /** Route string → owning `actionId` for binding-sourced rows. Lets the
   *  inspector look up an action's handler source per route. Phase-table
   *  routes are absent from this map (their callbacks come from the tool's
   *  PhaseDef function members, tagged directly by the Vite plugin). */
  bindingActionByRoute: Readonly<Record<string, string>>;
}

/** Union of phase-table routes (`def.initial` / `def.engaged`) and binding
 *  routes (`def.bindings`). Built-in tools route most gestures through
 *  bindings now — without folding them in, the inspector would show tools
 *  with empty / vestigial route lists. De-duped on the formatted string. */
function collectToolRoutes(def: ToolDef<unknown>): CollectedRoutes {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of formatRoutes(buildActionRegistry([def]))) {
    if (!seen.has(r)) { seen.add(r); out.push(r); }
  }
  const bindingActionByRoute: Record<string, string> = {};
  for (const { route, actionId } of bindingRouteRefs(def.bindings)) {
    if (!seen.has(route)) { seen.add(route); out.push(route); }
    // First binding wins if multiple bindings produced the same formatted
    // route (rare; only when two specs collapse to identical strings).
    if (!(route in bindingActionByRoute)) bindingActionByRoute[route] = actionId;
  }
  return { routes: out, bindingActionByRoute };
}

/** Map of `GestureSpec.kind` → `GestureName` used by the route grammar.
 *  `multiTouch` has no route-grammar gesture (only its tap synthesis does),
 *  so specs of that kind are skipped. */
const SPEC_KIND_TO_GESTURE: Record<GestureSpec['kind'], GestureName | undefined> = {
  key: 'keyDown',
  'key-held': 'keyHeld',
  wheel: 'wheel',
  click: 'click',
  doubleClick: 'dblTap',
  contextMenu: 'contextMenu',
  drag: 'drag',
  multiTouch: undefined,
  multiTouchTap: 'multiTouchTap',
};

function bindingRouteRefs(
  bindings: ToolDef<unknown>['bindings'],
): readonly { route: string; actionId: string }[] {
  if (!bindings || bindings.length === 0) return [];
  const out: { route: string; actionId: string }[] = [];
  for (const b of bindings) {
    for (const route of specToRouteStrings(b.spec)) {
      out.push({ route, actionId: b.actionId });
    }
  }
  return out;
}

/** Synthesize per-route `CallbackRef`s for binding-sourced routes. The
 *  Vite source-tag plugin only tags functions, and bindings are plain
 *  object literals — so binding routes have no native handler source.
 *  We bridge that gap by pointing each binding-route at its action's first
 *  invoker callback (the function that actually runs when the route fires).
 *
 *  The synthetic `label` is the formatted route string itself; the inspector's
 *  `findRouteCallback` matches by that exact string ahead of its legacy
 *  phase-keyed label probes. */
function synthBindingCallbacks(
  bindingActionByRoute: Readonly<Record<string, string>>,
  actionsByID: ReadonlyMap<string, unknown>,
): readonly CallbackRef[] {
  const out: CallbackRef[] = [];
  for (const [route, actionId] of Object.entries(bindingActionByRoute)) {
    const action = actionsByID.get(actionId);
    const source = bestActionHandlerSource(action);
    if (source) out.push({ label: route, source });
  }
  return out;
}

/** Pick the most relevant source-tagged function on an Action: prefer the
 *  invoker methods in dispatch order (start → run → move → end → cancel),
 *  fall back to `enabled`. Returns undefined when no member is tagged
 *  (prod builds, or files outside the Vite plugin's include set). */
function bestActionHandlerSource(action: unknown): CallbackSource | undefined {
  if (!action || typeof action !== 'object') return undefined;
  const a = action as { enabled?: unknown; invoker?: Record<string, unknown> };
  const inv = a.invoker;
  if (inv && typeof inv === 'object') {
    for (const key of ['start', 'run', 'move', 'end', 'cancel'] as const) {
      const s = sourceOf(inv[key]);
      if (s) return s;
    }
    // Fall through to any other invoker member that happens to be tagged.
    for (const v of Object.values(inv)) {
      const s = sourceOf(v);
      if (s) return s;
    }
  }
  return sourceOf(a.enabled);
}

function specToRouteStrings(spec: GestureSpec): readonly string[] {
  const gesture = SPEC_KIND_TO_GESTURE[spec.kind];
  if (!gesture) return [];
  const phases = phaseSpecToAtoms(spec.phase);
  const modifiers = modSpecToParsed(spec.mods);

  let args: readonly (string | undefined)[] = [undefined];
  let target: string | undefined;

  if (spec.kind === 'wheel') {
    args = [spec.direction ?? '*'];
  } else if (spec.kind === 'key' || spec.kind === 'key-held') {
    args = Array.isArray(spec.key) ? spec.key : [spec.key];
  } else if (spec.kind === 'multiTouchTap') {
    args = [String(spec.fingers)];
  } else if (
    spec.kind === 'click' || spec.kind === 'doubleClick' ||
    spec.kind === 'contextMenu' || spec.kind === 'drag'
  ) {
    target = targetSpecToString(spec.target);
  }

  return args.map((arg) => formatRoute({ phases, gesture, arg, target, modifiers }));
}

function phaseSpecToAtoms(phase: PhaseSpec | undefined): readonly PhaseAtom[] {
  // Bindings without a `phase` qualifier match in any phase. Surface that as
  // the explicit `*` atom rather than picking one of initial/engaged
  // arbitrarily — `formatRoute` renders it as `[*]` so the inspector reads
  // honestly.
  if (phase === undefined) return [{ channel: '&', phase: '*' }];
  if (phase === 'initial' || phase === 'engaged' || phase === '*') {
    return [{ channel: '&', phase }];
  }
  return phase;
}

function modSpecToParsed(mods: ModSpec | undefined): ParsedModifiers {
  if (!mods) return {};
  const out: ParsedModifiers = {};
  for (const name of ['mod', 'shift', 'alt', 'ctrl', 'meta'] as const) {
    const v = mods[name];
    if (v === true) out[name] = 'required';
    else if (v === 'optional') out[name] = 'optional';
  }
  return out;
}

/** Render a TargetSpec as the route grammar's target token. Predicate
 *  targets (`{ kindOf }`) collapse to a single sentinel string — the
 *  predicate body isn't representable in the v3 grammar, but emitting *some*
 *  target keeps the route in the inspector and groups predicate-bindings
 *  together under one `routeTarget` entry. */
function targetSpecToString(target: TargetSpec | undefined): string {
  if (target === undefined) return '*';
  if (typeof target === 'string') return target;
  return 'predicate';
}

const EMPTY_PHASE: PhaseSummary = {
  gestures: {
    click: false, pointerDown: false, dblTap: false, drag: false,
    wheel: false, keyDown: false, keyUp: false,
  },
  outputs: { cursor: false, overlay: false, claimsAll: false },
};

/** Boolean-only digest of a `PhaseDef`, partitioned into gestures (what the
 *  tool subscribes to) and outputs (what it declares / emits). Route
 *  signatures already cover the per-target dispatch detail. */
function summarizePhase(phase: NonNullable<ToolDef<unknown>['initial']>): PhaseSummary {
  const has = (k: keyof typeof phase): boolean => phase[k] !== undefined;
  return {
    gestures: {
      click: has('click'),
      pointerDown: has('pointerDown'),
      dblTap: has('dblTap'),
      drag: has('drag'),
      wheel: has('wheel'),
      keyDown: has('keyDown'),
      keyUp: has('keyUp'),
    },
    outputs: {
      cursor: has('cursor'),
      overlay: has('overlay'),
      claimsAll: has('claimsAll'),
    },
  };
}

/** Invoke an `Action.enabled` predicate and capture the result. Errors are
 *  swallowed — the same contract the runtime uses (`PredicateThrew`). */
function snapshotEnabled(
  fn: (() => true | string) | undefined,
): ActionEntry['enabled'] {
  if (!fn) return undefined;
  try {
    const r = fn();
    return r === true ? { enabled: true } : { enabled: false, reason: String(r) };
  } catch {
    return { enabled: false, reason: 'predicate-threw' };
  }
}

/** `ToolPresentation.icon` is `ReactNode | (scratch?) => ReactNode`. Tools
 *  in `src/tools/builtin/*` pass `createElement(SomeIcon)`, so the value is
 *  already a renderable element. For the thunk form we invoke with
 *  `undefined` scratch — the inspector has no live gesture state to feed in. */
function renderPresentationIcon(icon: unknown): ReactNode | undefined {
  if (icon === undefined || icon === null) return undefined;
  if (typeof icon === 'function') {
    try { return (icon as (s?: unknown) => ReactNode)(undefined); }
    catch { return undefined; }
  }
  if (isValidElement(icon)) return icon;
  // Strings / numbers / arrays are also valid ReactNodes.
  return icon as ReactNode;
}

/** Reads `__source` attached to a function value by the dev-only
 *  `weasel:callback-source` Vite plugin. Returns undefined in prod builds
 *  or when the plugin's `include` glob misses the file. */
function sourceOf(fn: unknown): CallbackSource | undefined {
  if (typeof fn !== 'function') return undefined;
  const src = (fn as { __source?: CallbackSource }).__source;
  return src && typeof src.file === 'string' ? src : undefined;
}

function pushCallback(out: CallbackRef[], label: string, fn: unknown): void {
  const source = sourceOf(fn);
  if (source) out.push({ label, source });
}

/** Walks a PhaseDef and pushes a `CallbackRef` for every function-valued
 *  leaf the dispatcher can call. Route tables fan out by target (and by
 *  modifier when the entry is a `ModifierRoute`). */
function collectPhaseCallbacks(
  out: CallbackRef[],
  phase: NonNullable<ToolDef<unknown>['initial']>,
  phaseLabel: string,
): void {
  const routeChannels = ['click', 'pointerDown', 'dblTap'] as const;
  for (const ch of routeChannels) {
    const tbl = phase[ch];
    if (!tbl || typeof tbl !== 'object') continue;
    for (const [target, entry] of Object.entries(tbl)) {
      if (typeof entry === 'function') {
        pushCallback(out, `${phaseLabel}.${ch}.${target}`, entry);
      } else if (entry && typeof entry === 'object') {
        for (const [mod, fn] of Object.entries(entry)) {
          pushCallback(out, `${phaseLabel}.${ch}.${target}:${mod}`, fn);
        }
      }
    }
  }
  // `drag` may be a route table OR a bare ActionFn.
  if (typeof phase.drag === 'function') {
    pushCallback(out, `${phaseLabel}.drag`, phase.drag);
  } else if (phase.drag && typeof phase.drag === 'object') {
    for (const [target, entry] of Object.entries(phase.drag)) {
      if (typeof entry === 'function') {
        pushCallback(out, `${phaseLabel}.drag.${target}`, entry);
      } else if (entry && typeof entry === 'object') {
        for (const [mod, fn] of Object.entries(entry)) {
          pushCallback(out, `${phaseLabel}.drag.${target}:${mod}`, fn);
        }
      }
    }
  }
  pushCallback(out, `${phaseLabel}.wheel`, phase.wheel);
  for (const ch of ['keyDown', 'keyUp'] as const) {
    const tbl = phase[ch];
    if (!tbl) continue;
    for (const [key, fn] of Object.entries(tbl)) {
      pushCallback(out, `${phaseLabel}.${ch}.${key}`, fn);
    }
  }
  if (typeof phase.cursor === 'function') {
    pushCallback(out, `${phaseLabel}.cursor`, phase.cursor);
  }
  pushCallback(out, `${phaseLabel}.overlay`, phase.overlay);
  if (typeof phase.claimsAll === 'function') {
    pushCallback(out, `${phaseLabel}.claimsAll`, phase.claimsAll);
  }
}

function collectToolCallbacks(def: ToolDef<unknown>): readonly CallbackRef[] {
  const out: CallbackRef[] = [];
  pushCallback(out, 'initScratch', def.initScratch);
  pushCallback(out, 'onActivate', def.onActivate);
  pushCallback(out, 'onDeactivate', def.onDeactivate);
  pushCallback(out, 'hitOverride', def.hitOverride);
  if (typeof def.cursor === 'function') pushCallback(out, 'cursor', def.cursor);
  if (def.initial) collectPhaseCallbacks(out, def.initial, 'initial');
  if (def.engaged) collectPhaseCallbacks(out, def.engaged, 'engaged');
  return out;
}

function collectActionCallbacks(action: unknown): readonly CallbackRef[] {
  const out: CallbackRef[] = [];
  if (!action || typeof action !== 'object') return out;
  const a = action as { enabled?: unknown; invoker?: unknown };
  pushCallback(out, 'enabled', a.enabled);
  if (a.invoker && typeof a.invoker === 'object') {
    for (const [k, v] of Object.entries(a.invoker as Record<string, unknown>)) {
      pushCallback(out, `invoker.${k}`, v);
    }
  }
  return out;
}
