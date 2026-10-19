import { useEffect, useMemo, useRef, useState } from 'react';
import {
  actionBindings,
  actionItems,
  keySpecShortcut,
  SceneCanvas,
  defaultNodeRouting,
  defaultNodeProperties,
  useActionsRegistry,
  useScene,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type ToolDef,
  type ToolsApi,
  BUILTIN_TOOL_IDS,
} from '@weasel-js/core';
import { routesForSpec } from '@weasel-js/core/routing';
import { actionIcon } from '@weasel-js/ui/components/Icon';
import { appCommandsContribution, type AppCommands } from '../appCommands';
import { DRAW_LAYERS, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from '../drawDocument';
import { DRAW_FEATURES } from '../drawFeatures';
import { useFileCommands } from '../fileCommands';
import type { DeclaredRoute, ToolSurface, ToolEntry, ActionEntry, CallbackRef, CallbackSource } from './registryEntries';
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

const noop = () => {};

/** The app's own commands at rest: what the probe's copies of them read. */
const IDLE_COMMANDS: AppCommands = {
  gridVisible: false, toggleGrid: noop, snapToGrid: false, toggleSnap: noop,
  pathDirection: false, togglePathDirection: noop, symmetryOn: false, toggleSymmetry: noop,
  canReleaseCompound: false, releaseCompound: noop, openPrefs: noop, openPalette: noop,
  chromeHidden: () => false, toggleChrome: noop,
};
const AMBIENT = [appCommandsContribution(() => IDLE_COMMANDS)];

/** Mounts a hidden SceneCanvas with the exhaustive tool bundle and the app's features, own commands
 *  and file commands, lets it auto-wire their actions into the surrounding `ActionsProvider`, and
 *  calls `onSnapshot` with the resulting tool/action lists on every change. */
export function RegistryProbe({ onSnapshot }: ProbeProps) {
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [...DRAW_LAYERS],
    initial: [],
  });
  useFileCommands({
    scene, filename: 'probe', paperSize: 'letter', backgroundColor: '#ffffff',
    setFilename: noop, setPaperSize: noop, setBackgroundColor: noop,
  });

  // `onToolsCreated` fires every render because `useTools` synthesizes a new ToolsApi literal
  // each render. Track only the structural signature (registry tool ids) to avoid a render loop.
  const [toolsRegistrySig, setToolsRegistrySig] = useState<string>('');
  const toolsRef = useRef<ToolsApi | null>(null);
  const handleToolsCreated = (api: ToolsApi) => {
    toolsRef.current = api;
    const sig = Object.keys(api.registry).sort().join(',');
    setToolsRegistrySig((prev) => (prev === sig ? prev : sig));
  };
  const tools = toolsRef.current;
  const reg = useActionsRegistry();

  // `reg.list()` returns a new array each call; re-rendering when tools change is enough to
  // refresh the action list.
  const actionsList = reg ? reg.list() : [];

  // Action object identity is unstable, so memoization keys on the sorted ids instead.
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
    // Registry and ambient slots both — ambient holds resize / rotate / wheel-zoom.
    type Slot = { id: string; def?: unknown; cursor?: unknown; bindings?: unknown; overlay?: unknown };
    const tagged: Array<{ slot: 'registry' | 'ambient'; t: Slot }> = [
      ...Object.values(tools.registry).map((t) => ({ slot: 'registry' as const, t })),
      ...tools.ambient.map((t) => ({ slot: 'ambient' as const, t })),
    ];
    const seen = new Set<string>();
    return tagged
      .filter(({ t }) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .map(({ slot, t }): ToolEntry => {
        const def = t.def as ToolDef | undefined;
        const callbacks = def ? collectToolCallbacks(def) : [];
        const declaredRoutes = def
          ? collectDeclaredRoutes(
              def,
              t.bindings as ToolDef['bindings'],
              callbacks,
              actionsByID,
            )
          : [];
        // Catalog view: the distinct route signatures this tool contributes.
        const routes = [...new Set(declaredRoutes.map((r) => r.route))];
        // Read the Tool, not the def: a hook can attach an overlay to the
        // returned Tool rather than declaring it, and reading the def alone
        // reports "emits no overlay" for an overlay-only ambient tool.
        const surface = summarizeSurface(t as Parameters<typeof summarizeSurface>[0]);
        return {
          kind: 'tool',
          id: t.id,
          label: def?.presentation?.label ?? t.id,
          hookName: def?.hookName,
          cursor: typeof t.cursor === 'string' ? t.cursor : undefined,
          routes,
          declaredRoutes,
          slot,
          switchShortcut: def?.keybinding,
          hotkey: def?.hotkey,
          presentation: def?.presentation ? {
            label: def.presentation.label,
            group: def.presentation.group,
            shortcut: def.presentation.shortcut,
            icon: actionIcon(def.presentation.icon),
          } : undefined,
          surface,
          capabilities: {
            onActivate: !!def?.onActivate,
            onDeactivate: !!def?.onDeactivate,
          },
          callbacks,
        };
      });
  }, [tools, toolsRegistrySig, actionsByID]);

  const actionEntries: readonly ActionEntry[] = actionsList.map((a): ActionEntry => ({
    kind: 'action',
    id: a.id,
    label: a.label ?? a.id,
    bindingShortcut: actionBindings(a).map(({ spec }) => keySpecShortcut(spec)).find((k) => k !== undefined),
    shortcut: a.shortcut,
    group: a.group,
    icon: actionIcon(a.icon),
    items: actionItems(a).map((i) => ({ key: i.key, label: i.label, ...(i.icon ? { icon: i.icon } : {}) })),
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
        features={DRAW_FEATURES} defaultTools={BUILTIN_TOOL_IDS}
        ambient={AMBIENT}
        routing={defaultNodeRouting}
        onToolsCreated={handleToolsCreated}
      />
    </div>
  );
}


/** Every route a tool declares, in declaration order. Routes are not de-duped: several bindings
 *  legitimately format to the same string while dispatching to different actions — select
 *  declares three predicate-target drags (resize / rotate / move) and the grammar renders every
 *  one of them `[*:*] drag => predicate`.
 *
 *  `bindings` is read off the runtime `Tool`, not off `def`, because that's what the dispatcher
 *  reads: a hook is free to attach bindings to the returned Tool instead of declaring them in
 *  the def. */
export function collectDeclaredRoutes(
  def: ToolDef,
  bindings: ToolDef['bindings'],
  _callbacks: readonly CallbackRef[],
  actionsByID: ReadonlyMap<string, unknown>,
): readonly DeclaredRoute[] {
  const out: DeclaredRoute[] = [];
  for (const { route, actionId } of bindingRouteRefs(bindings ?? def.bindings)) {
    // Bindings are plain object literals, so the source-tag plugin has no function to tag.
    // Cite the action's invoker instead.
    out.push({ route, actionId, source: bestActionHandlerSource(actionsByID.get(actionId)) });
  }
  return out;
}

function bindingRouteRefs(
  bindings: ToolDef['bindings'],
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

/** The most relevant source-tagged function on an Action: the invoker methods in dispatch
 *  order, then `enabled`. Undefined when no member is tagged (prod builds, or files outside
 *  the Vite plugin's include set). */
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
 *  detail; this is the at-a-glance row. */
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

function collectToolCallbacks(def: ToolDef): readonly CallbackRef[] {
  const out: CallbackRef[] = [];
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
