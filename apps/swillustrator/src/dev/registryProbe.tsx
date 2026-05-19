import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useActionsRegistry,
  useScene,
  type ToolsApi,
} from '@orochi235/weasel';
import { buildActionRegistry, formatRoute, type RegistryEntry } from '@orochi235/weasel/routing';
import type { ToolDef } from '@orochi235/weasel/routing';
import { isValidElement, type ReactNode } from 'react';
import type { PhaseSummary, ToolEntry, ActionEntry, CallbackRef, CallbackSource } from './registryData';
import { TOOL_HOOK_NAMES } from './registryData';
import { formatShortcutParts } from '@orochi235/weasel-ui';
import s from './RegistryInspector.module.css';

export interface RegistrySnapshot {
  readonly tools: readonly ToolEntry[];
  readonly actions: readonly ActionEntry[];
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
        const routes = def ? formatRoutes(buildActionRegistry([def])) : [];
        const initial = def ? summarizePhase(def.initial) : EMPTY_PHASE;
        const engaged = def?.engaged ? summarizePhase(def.engaged) : undefined;
        return {
          kind: 'tool',
          id: t.id,
          label: def?.presentation?.label ?? t.id,
          hookName: TOOL_HOOK_NAMES[t.id],
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
          callbacks: def ? collectToolCallbacks(def) : [],
        };
      });
  }, [tools, toolsRegistrySig]);

  const actionEntries: readonly ActionEntry[] = actionsList.map((a): ActionEntry => ({
    kind: 'action',
    id: a.id,
    label: a.label ?? a.id,
    // Phase 14e Task 7: Action.defaultBinding removed; bindings live on
    // defaultBinding. formatShortcutParts only consumes the legacy shape,
    // so we pass undefined for now (TODO: defaultBinding-aware formatter).
    shortcutParts: formatShortcutParts(undefined),
    shortcut: a.shortcut,
    group: a.group ?? idGroup(a.id),
    icon: renderPresentationIcon(a.icon),
    enabled: snapshotEnabled(a.enabled),
    callbacks: collectActionCallbacks(a),
  }));

  const lastRef = useRef<string>('');
  useEffect(() => {
    const sig = JSON.stringify({
      t: toolEntries.map((t) => t.id),
      a: actionEntries.map((a) => a.id),
    });
    if (sig === lastRef.current) return;
    lastRef.current = sig;
    onSnapshot({ tools: toolEntries, actions: actionEntries });
  });

  return (
    <div aria-hidden="true" className={s.hidden}>
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        toolBundle="exhaustive"
        onToolsCreated={handleToolsCreated}
      />
    </div>
  );
}

function formatRoutes(entries: readonly RegistryEntry[]): readonly string[] {
  return entries.map((e) => formatRoute({
    phases: [e.phase],
    gesture: e.gesture,
    arg: e.arg,
    target: e.target,
    modifiers: e.modifiers,
  }));
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

/** Derive a category from a dotted id when the action sets no explicit
 *  `group` (e.g. `align.left` → `align`, `reorder.front` → `reorder`). Returns
 *  undefined for single-segment ids — those tend to be one-offs (`delete`,
 *  `undo`) that don't need a category. */
function idGroup(id: string): string | undefined {
  const dot = id.indexOf('.');
  return dot > 0 ? id.slice(0, dot) : undefined;
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
