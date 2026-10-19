import { useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import {
  createDispatchTrace, createTraceRing, type Contribution, type DepRegistry, type DispatchTrace, type TraceRing,
} from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { DebugConfig } from '../../debug/types';
import { parseDebugFlags } from '../../debug/parseDebugFlags';
import { recordHistory } from '../../devtools/history';
import type { DevtoolsHistoryRecord } from '../../devtools/protocol';
import { describeRegistry } from '../../devtools/registry';
import type { DevtoolsRoot } from '../../devtools/root';
import { useDevtoolsRoot, type DevtoolsOverride } from '../../devtools/useDevtoolsRoot';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { CanvasViewState } from '../useCanvasView';
import type { CoordTraceEntry } from './coordTrace';
import { inferredNodeRouting } from './defaultNodeRouting';

/** A canvas's trace buffers: its dispatchers' decisions, its `clientToWorld` conversions, and its scene's history steps. */
export interface CanvasTraces {
  dispatch: DispatchTrace;
  coords: TraceRing<CoordTraceEntry>;
  history: TraceRing<DevtoolsHistoryRecord>;
}

/** What `<SceneCanvas>` hands its input wiring for devtools: the `debug` in effect and the override's setter. */
export interface CanvasDevtools {
  debug: DebugConfig | false | undefined;
  setOverride(override: DevtoolsOverride | null): void;
}

function resolved(debug: DebugConfig | false | undefined): DebugConfig | null {
  if (debug === false) return null;
  if (debug !== undefined) return debug;
  return typeof window === 'undefined' ? null : parseDebugFlags(window.location.search);
}

/** What `get-registry` reports of `deps`, as one comparable string; null for a registry that cannot list itself. */
function depListingKey(deps: DepRegistry): string | null {
  return deps.list?.().map((d) => `${d.name}:${d.depth}:${d.stacked}`).join('\u0000') ?? null;
}

/** This canvas's trace buffers and its devtools root, read from the latest render. */
export function useCanvasDevtoolsRoot(c: {
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  viewState: CanvasViewState;
  tools: ToolsApi;
  /** The entries the canvas's `features` presets brought beside its tools. */
  contributions: readonly Contribution<unknown>[];
  routing: readonly NodeRoutingEntry[] | undefined;
  element: MutableRefObject<HTMLElement | null>;
  api: RefObject<CanvasExtensionApi | null>;
  devtools: CanvasDevtools;
}): { root: DevtoolsRoot; traces: CanvasTraces } {
  const [traces] = useState<CanvasTraces>(() => ({
    dispatch: createDispatchTrace(),
    coords: createTraceRing<CoordTraceEntry>(),
    history: createTraceRing<DevtoolsHistoryRecord>(),
  }));
  const actions = useActionsRegistry();
  const deps = useDepRegistry();
  const root = useDevtoolsRoot({
    label: () => {
      const el = c.element.current;
      return el?.getAttribute('aria-label') || el?.id
        || el?.parentElement?.closest('[aria-label]')?.getAttribute('aria-label') || '';
    },
    scene: () => c.scene,
    selection: () => c.selection.current,
    select: (ids) => c.selection.set([...ids] as NodeId[]),
    view: () => c.viewState.getView(),
    activeTool: () => c.tools.active ?? null,
    tools: () => Object.keys(c.tools.registry),
    setTool: (id) => c.tools.setActive(id),
    trace: traces.dispatch,
    coords: traces.coords,
    frame: () => c.api.current?.getDebug()?.snapshot().frame ?? null,
    overlays: () => resolved(c.devtools.debug),
    setOverride: (o) => c.devtools.setOverride(o),
    subscribeView: c.viewState.subscribeView,
    registry: () => describeRegistry({
      tools: c.tools, contributions: c.contributions, actions, deps,
      routingKinds: (c.routing ?? inferredNodeRouting).map((k) => k.name),
    }),
    subscribeRegistry(listener) {
      // The dep registry also notifies when a source's value changes, as every selection does; only the listing is ours.
      let listed = depListingKey(deps);
      const onDeps = (): void => {
        const next = depListingKey(deps);
        if (next !== null && next === listed) return;
        listed = next;
        listener();
      };
      const offs = [actions?.subscribe(listener), deps.subscribe?.(onDeps)];
      return () => { for (const off of offs) off?.(); };
    },
    history: traces.history,
  }, { selection: c.selection.current, tool: c.tools.active ?? null });
  useEffect(() => recordHistory(c.scene.history, traces.history), [c.scene, traces.history]);
  const { registry, ambient } = c.tools;
  useEffect(() => { root.notify('registry'); }, [root, registry, ambient, c.contributions, c.routing]);
  return { root, traces };
}
