import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  defaultNodeRouting,
  defaultNodeProperties,
  useActionsRegistry,
  useScene,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type ToolDef,
  type ToolsApi,
  type FillStyle,
} from '@weasel-js/core';
import { routesForSpec } from '@weasel-js/core/routing';
import { isValidElement, type ReactNode } from 'react';
import type { DeclaredRoute, ToolSurface, ToolEntry, ActionEntry, CallbackRef, CallbackSource } from './registryData';
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

interface ShapeData { fill: FillStyle }
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
        // Read the Tool, not the def: a hook can attach an overlay to the
        // returned Tool rather than declaring it (`useRotateTool` does — it's
        // an overlay-only ambient tool), and reading the def alone reported
        // "emits no overlay" for exactly the tools that are nothing but one.
        const surface = summarizeSurface(t as Parameters<typeof summarizeSurface>[0]);
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
          surface,
          capabilities: {
            initScratch: !!def?.initScratch,
            onActivate: !!def?.onActivate,
            onDeactivate: !!def?.onDeactivate,
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
export function collectDeclaredRoutes(
  def: ToolDef<unknown>,
  bindings: ToolDef<unknown>['bindings'],
  _callbacks: readonly CallbackRef[],
  actionsByID: ReadonlyMap<string, unknown>,
): readonly DeclaredRoute[] {
  const out: DeclaredRoute[] = [];
  // Bindings are the whole surface. This used to walk the phase tables via
  // `buildActionRegistry(def)` first and append bindings after — which is
  // why select reported 6 routes when it declared 14: the phase walk was
  // blind to `Tool.bindings`, and by the end that was where nearly every
  // route lived.
  for (const { route, actionId } of bindingRouteRefs(bindings ?? def.bindings)) {
    // Bindings are plain object literals, so the source-tag plugin has no
    // function to tag. Cite the action's invoker instead — that's the code
    // that actually runs when the route fires.
    out.push({ route, actionId, source: bestActionHandlerSource(actionsByID.get(actionId)) });
  }
  return out;
}

function bindingRouteRefs(
  bindings: ToolDef<unknown>['bindings'],
): readonly { route: string; actionId: string }[] {
  if (!bindings || bindings.length === 0) return [];
  const out: { route: string; actionId: string }[] = [];
  for (const b of bindings) {
    for (const route of routesForSpec(b.spec)) {
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

/** `GestureSpec.kind` -> the `GestureChannels` key it sets. */
const CHANNEL_FOR_KIND: Readonly<Record<string, string>> = {
  click: 'click',
  doubleClick: 'doubleClick',
  pointerDown: 'pointerDown',
  drag: 'drag',
  wheel: 'wheel',
  key: 'key',
  'key-held': 'keyHeld',
  contextMenu: 'contextMenu',
  multiTouchTap: 'multiTouchTap',
};

/** Boolean-only digest of a tool's input surface: which gesture kinds its
 *  bindings declare, and what it emits. Route signatures carry the per-target
 *  detail; this is the at-a-glance row.
 *
 *  Was `summarizePhase(def.initial)` — a walk over the phase tables, which
 *  meant it reported nothing at all for a tool whose whole surface was
 *  `Tool.bindings`. That was most of them by the end. */
function summarizeSurface(tool: { bindings?: readonly { spec: { kind: string } }[]; cursor?: unknown; overlay?: unknown }): ToolSurface {
  const gestures: Record<string, boolean> = {
    click: false, doubleClick: false, pointerDown: false, drag: false,
    wheel: false, key: false, keyHeld: false, contextMenu: false,
    multiTouchTap: false,
  };
  for (const b of tool.bindings ?? []) {
    const channel = CHANNEL_FOR_KIND[b.spec.kind];
    if (channel) gestures[channel] = true;
  }
  return {
    gestures: gestures as unknown as ToolSurface['gestures'],
    outputs: {
      cursor: tool.cursor !== undefined,
      overlay: tool.overlay !== undefined,
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

function collectToolCallbacks(def: ToolDef<unknown>): readonly CallbackRef[] {
  const out: CallbackRef[] = [];
  pushCallback(out, 'initScratch', def.initScratch);
  pushCallback(out, 'onActivate', def.onActivate);
  pushCallback(out, 'onDeactivate', def.onDeactivate);
  if (typeof def.cursor === 'function') pushCallback(out, 'cursor', def.cursor);
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
