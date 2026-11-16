/**
 * The page side's way onto a canvas: a contribution whose `attach` registers
 * the canvas with the devtools hook, installing the hook first. A canvas that
 * never takes it keeps no root, no history record and no coord trace.
 */
import type {
  CanvasExtensionApi, CanvasInspection, ContributionDepReader, CoordTraceEntry, DebugFlags, Scene, SurfaceContribution,
} from '@weasel-js/core';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import { installDevtoolsHook, type WeaselDevtoolsHook } from './hook';
import { recordHistory } from './history';
import type { DevtoolsHistoryRecord } from './protocol';
import { describeRegistry } from './registry';
import { createDevtoolsRoot, type DevtoolsRoot, type DevtoolsRootSource } from './root';

/** The name a panel lists `el`'s canvas under: its own `aria-label` or id, the nearest `<DevtoolsLabel>`'s
 *  value (`framed`), then the nearest labeled ancestor's `aria-label`. */
function labelOf(el: HTMLElement | null, framed: string | null | undefined): string {
  return el?.getAttribute('aria-label') || el?.id || framed
    || el?.parentElement?.closest('[aria-label]')?.getAttribute('aria-label') || '';
}

function dimensionOf(scene: Scene<unknown, string, unknown> | null): '2d' | '3d' {
  const first = scene?.roots[0];
  const pose = first ? scene?.get(first)?.pose : undefined;
  return typeof (pose as { position?: { z?: unknown } } | undefined)?.position?.z === 'number' ? '3d' : '2d';
}

/** What `get-registry` reports of the dep registry, as one comparable string; null for one that cannot list itself. */
function depListingKey(deps: ReturnType<CanvasInspection['deps']>): string | null {
  return deps.list?.().map((d) => `${d.name}:${d.depth}:${d.stacked}`).join('\u0000') ?? null;
}

/** What a canvas reads before its dispatcher, or its inspection, has published its own. */
const NO_TRACE = createDispatchTrace(1, false);
const NO_COORDS = createTraceRing<CoordTraceEntry>(1, false);
const NO_PROBES: ReadonlyMap<string, () => unknown> = new Map();

/** The root over one canvas, read through its api and deps. Its history ring follows the canvas's scene. */
export function canvasRoot(api: CanvasExtensionApi, deps: ContributionDepReader): { root: DevtoolsRoot; stop(): void } {
  const inspection = (): CanvasInspection | undefined => deps.get('inspection');
  const scene = (): Scene<unknown, string, unknown> | null => deps.get('scene') ?? null;
  const history = createTraceRing<DevtoolsHistoryRecord>();
  let recorded: Scene<unknown, string, unknown> | null = null;
  let stopRecording: (() => void) | null = null;
  const followHistory = (): void => {
    const s = scene();
    if (s === recorded) return;
    stopRecording?.();
    recorded = s;
    stopRecording = s ? recordHistory(s.history, history) : null;
  };
  const source: DevtoolsRootSource = {
    label: () => labelOf(api.element, inspection()?.label()),
    get dimension() { return dimensionOf(scene()); },
    scene,
    selection: () => (deps.get('selection')?.current as readonly string[] | undefined) ?? [],
    select: (ids) => deps.get('selection')?.set([...ids] as never),
    view: () => api.getView(),
    activeTool: () => inspection()?.tools().active ?? null,
    tools: () => Object.keys(inspection()?.tools().registry ?? {}),
    setTool: (id) => inspection()?.tools().setActive(id),
    get trace() { return deps.get('dispatchTrace') ?? NO_TRACE; },
    get coords() { return inspection()?.coords() ?? NO_COORDS; },
    frame: () => api.getDebug()?.snapshot().frame ?? null,
    overlays: () => inspection()?.debug() ?? null,
    setOverride: (o) => inspection()?.setDebugOverride(o && ({
      ...o.overlays, ...(o.highlight.length ? { highlight: o.highlight } : {}),
    } as DebugFlags)),
    registry() {
      const i = inspection();
      if (!i) throw new Error('this canvas offers no inspection');
      const actions = i.actions();
      return describeRegistry({
        tools: i.tools(), contributions: i.contributions(), actions, deps: i.deps(),
        ...(actions ? { overrides: actions.bindingOverrides() } : {}),
        routingKinds: i.routingKinds(),
      });
    },
    subscribe(listener) {
      const i = inspection();
      if (!i) return () => {};
      const actions = i.actions(), registry = i.deps();
      // The dep registry also notifies when a source's value changes, as every selection does; only the listing is ours.
      let listed = depListingKey(registry);
      const onDeps = (): void => {
        const next = depListingKey(registry);
        if (next !== null && next === listed) return;
        listed = next;
        listener('registry');
      };
      const offs = [
        i.subscribe(listener),
        actions?.subscribe(() => listener('registry')),
        registry.subscribe?.(onDeps),
        api.subscribeView(() => listener('view')),
      ];
      return () => { for (const off of offs) off?.(); };
    },
    history,
    get probes() { return inspection()?.probes ?? NO_PROBES; },
  };
  const root = createDevtoolsRoot(source);
  followHistory();
  const offScene = inspection()?.subscribe((change) => { if (change === 'scene') followHistory(); });
  return { root, stop: () => { offScene?.(); stopRecording?.(); } };
}

/** Register the canvas behind `api` with `hook`. Returns the removal. */
export function attachDevtools(
  api: CanvasExtensionApi,
  deps: ContributionDepReader,
  hook: WeaselDevtoolsHook | null = installDevtoolsHook(),
): () => void {
  if (!hook) return () => {};
  const { root, stop } = canvasRoot(api, deps);
  const unregister = hook.register(root);
  return () => { unregister(); stop(); };
}

/**
 * Puts each canvas that takes it in a devtools panel's view: installs the
 * devtools hook on `window.__weaselDevtools__` and registers the canvas with
 * it. Hand it to every canvas with `<AmbientContributionsProvider
 * contributions={[devtools]}>`, or to one with `<SceneCanvas ambient>`.
 */
export const devtools: SurfaceContribution = {
  id: 'devtools', eligibility: { always: true }, attach: (api, deps) => attachDevtools(api, deps),
};
