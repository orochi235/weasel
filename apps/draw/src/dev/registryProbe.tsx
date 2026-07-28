import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  defaultNodeRouting,
  defaultNodeProperties,
  useActionsRegistry,
  useScene,
  type GestureSpec,
  type ModSpec,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type TargetSpec,
  type ToolsApi,
} from '@weasel-js/core';
import type { PhaseSpec } from '@weasel-js/gestures';
import { buildActionRegistry, formatRoute, mods, parseRoute, type ModifierCombo, type RegistryEntry } from '@weasel-js/core/routing';
import type {
  GestureName,
  ParsedModifiers,
  PhaseAtom,
  ToolDef,
} from '@weasel-js/core/routing';
import { isValidElement, type ReactNode } from 'react';
import type { DeclaredRoute, PhaseSummary, ToolEntry, ActionEntry, CallbackRef, CallbackSource } from './registryData';
import { formatShortcutParts } from '@weasel-js/ui';
import s from './RegistryInspector.module.css';

export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
  readonly routing: readonly NodeRoutingEntry[];
  readonly properties: readonly NodePropertiesEntry[];
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
    type Slot = { id: string; def?: unknown; cursor?: unknown; bindings?: unknown; overlay?: unknown };
    const tagged: Array<{ slot: 'registry' | 'ambient'; t: Slot }> = [
      ...Object.values(tools.registry).map((t) => ({ slot: 'registry' as const, t })),
      ...tools.ambient.map((t) => ({ slot: 'ambient' as const, t })),
    ];
    const seen = new Set<string>();
    return tagged
      .filter(({ t }) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .map(({ slot, t }): ToolEntry => {
        const def = t.def as ToolDef<unknown> | undefined;
        const callbacks = def ? collectToolCallbacks(def) : [];
        const declaredRoutes = def
          ? collectDeclaredRoutes(
              def,
              t.bindings as ToolDef<unknown>['bindings'],
              callbacks,
              actionsByID,
            )
          : [];
        // Catalog view: the distinct route signatures this tool contributes.
        const routes = [...new Set(declaredRoutes.map((r) => r.route))];
        const summarized = def ? summarizePhase(def.initial) : EMPTY_PHASE;
        // Same Tool-vs-def split as `bindings`: `defineTool` derives the
        // Tool's overlay from `def.initial.overlay`, but a hook can attach one
        // to the returned Tool instead (`useRotateTool` does — it's an
        // overlay-only ambient tool). Reading the def alone reported "emits no
        // overlay" for exactly the tools that are nothing but an overlay.
        const initial: PhaseSummary = t.overlay === undefined
          ? summarized
          : { ...summarized, outputs: { ...summarized.outputs, overlay: true } };
        const engaged = def?.engaged ? summarizePhase(def.engaged) : undefined;
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
          declaredRoutes,
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
          callbacks,
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
    onSnapshot({ tools: toolEntries, actions: actionEntries, routing: defaultNodeRouting, properties: defaultNodeProperties });
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

/** Every route a tool declares, in declaration order: phase-table routes
 *  (`def.initial` / `def.engaged`) first, then binding routes. Built-in tools
 *  route most gestures through bindings now — without folding them in, the
 *  inspector would show tools with empty / vestigial route lists.
 *
 *  Phase-table routes are de-duped on the formatted string (they come out of
 *  `buildActionRegistry`, which can emit the same signature twice). Binding
 *  routes are NOT: several bindings legitimately format to the same string
 *  while dispatching to different actions — select declares three
 *  predicate-target drags (resize / rotate / move) and the grammar renders
 *  every one of them `[*] drag => predicate`. Collapsing those hid two real
 *  routes and mislabeled the third.
 *
 *  `bindings` is read off the runtime `Tool`, not off `def`, because that's
 *  what the dispatcher reads. `defineTool` copies `def.bindings` onto the
 *  Tool it returns, but a hook is free to attach bindings to the returned
 *  Tool instead of declaring them in the def (`useSelectTool` does exactly
 *  that — it spreads the defineTool result and appends `bindings`). Reading
 *  `def.bindings` alone missed every one of those. */
function collectDeclaredRoutes(
  def: ToolDef<unknown>,
  bindings: ToolDef<unknown>['bindings'],
  phaseCallbacks: readonly CallbackRef[],
  actionsByID: ReadonlyMap<string, unknown>,
): readonly DeclaredRoute[] {
  const seen = new Set<string>();
  const out: DeclaredRoute[] = [];
  for (const route of formatRoutes(buildActionRegistry([def]))) {
    if (seen.has(route)) continue;
    seen.add(route);
    out.push({ route, source: findPhaseCallback(route, phaseCallbacks)?.source });
  }
  for (const { route, actionId } of bindingRouteRefs(bindings ?? def.bindings)) {
    // Bindings are plain object literals, so the source-tag plugin has no
    // function to tag. Cite the action's invoker instead — that's the code
    // that actually runs when the route fires.
    out.push({ route, actionId, source: bestActionHandlerSource(actionsByID.get(actionId)) });
  }
  return out;
}

/** Locate the phase-table handler behind a formatted route string, by
 *  reconstructing the dotted label `collectPhaseCallbacks` assigned it
 *  (`initial.click.empty:shift`, `engaged.keyDown.Escape`, …). Returns
 *  undefined when the dev plugin didn't tag the function. */
function findPhaseCallback(
  route: string,
  callbacks: readonly CallbackRef[],
): CallbackRef | undefined {
  const parsed = parseRoute(route);
  const phase = parsed.phases[0]?.phase;
  if (!phase) return undefined;
  const g = parsed.gesture;
  const candidates: string[] = [];
  if (g === 'wheel') {
    candidates.push(`${phase}.wheel`);
  } else if (g === 'keyDown' || g === 'keyUp') {
    if (parsed.arg) candidates.push(`${phase}.${g}.${parsed.arg}`);
  } else if (g === 'click' || g === 'pointerDown' || g === 'dblTap' || g === 'drag') {
    const target = parsed.target ?? '*';
    // Sub-table keys are `ModifierCombo` strings (`mods('mod','shift')` →
    // `'mod+shift'`), NOT the `name=requiredness` form `canonicalModifiers`
    // emits — matching on the latter never hit, which is why every
    // modifier-variant route showed a blank source.
    const modKey = modifierComboOf(parsed.modifiers);
    if (modKey !== 'default') candidates.push(`${phase}.${g}.${target}:${modKey}`);
    candidates.push(`${phase}.${g}.${target}`);
    // Bare drag function lives at `${phase}.drag` with no target/mod suffix.
    if (g === 'drag') candidates.push(`${phase}.drag`);
  }
  for (const label of candidates) {
    const hit = callbacks.find((c) => c.label === label);
    if (hit) return hit;
  }
  return undefined;
}

/** `ParsedModifiers` → the `ModifierCombo` key a route sub-table is authored
 *  with. Optional modifiers don't participate: they widen a route rather than
 *  selecting a distinct sub-table. */
function modifierComboOf(parsed: ParsedModifiers): ModifierCombo {
  const required = (['mod', 'shift', 'alt'] as const).filter((n) => parsed[n] === 'required');
  return mods(...required);
}

/** Map of `GestureSpec.kind` → `GestureName` used by the route grammar.
 *  `multiTouch` has no route-grammar gesture (only its tap synthesis does),
 *  so specs of that kind are skipped. Likewise `drop` / `paste`: the
 *  content-ingestion gestures shipped without route-grammar names, so the
 *  inspector skips their bindings too. Adding `drop` / `paste` to the route
 *  grammar is a tracked follow-up (docs/TODO.md, ingestion residuals). */
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
  drop: undefined,
  paste: undefined,
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
    click: false, pointerDown: false, drag: false,
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
  const routeChannels = ['click', 'pointerDown'] as const;
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
