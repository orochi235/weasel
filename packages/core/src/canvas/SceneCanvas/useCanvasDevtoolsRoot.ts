import { useState, type MutableRefObject, type RefObject } from 'react';
import { createDispatchTrace, createTraceRing, type DispatchTrace, type TraceRing } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { DebugConfig } from '../../debug/types';
import { parseDebugFlags } from '../../debug/parseDebugFlags';
import type { DevtoolsRoot } from '../../devtools/root';
import { useDevtoolsRoot, type DevtoolsOverride } from '../../devtools/useDevtoolsRoot';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { CanvasViewState } from '../useCanvasView';
import type { CoordTraceEntry } from './coordTrace';

/** A canvas's two trace buffers: its dispatchers' decisions, and its `clientToWorld` conversions. */
export interface CanvasTraces {
  dispatch: DispatchTrace;
  coords: TraceRing<CoordTraceEntry>;
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

/** This canvas's trace buffers and its devtools root, read from the latest render. */
export function useCanvasDevtoolsRoot(c: {
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  viewState: CanvasViewState;
  tools: ToolsApi;
  element: MutableRefObject<HTMLElement | null>;
  api: RefObject<CanvasExtensionApi | null>;
  devtools: CanvasDevtools;
}): { root: DevtoolsRoot; traces: CanvasTraces } {
  const [traces] = useState<CanvasTraces>(() => ({
    dispatch: createDispatchTrace(),
    coords: createTraceRing<CoordTraceEntry>(),
  }));
  const root = useDevtoolsRoot({
    label: () => {
      const el = c.element.current;
      return el?.getAttribute('aria-label') || el?.id || '';
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
  }, { selection: c.selection.current, tool: c.tools.active ?? null });
  return { root, traces };
}
