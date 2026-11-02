/**
 * A root: what one mounted `<SceneCanvas>` exposes to the devtools hook and to
 * the test hook. The canvas supplies live getters; the root adds change
 * versions and the probe registry.
 */
import { createEmitter } from '@weasel-js/registry';
import type { DispatchTrace, TraceRing } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import type { CoordTraceEntry } from '../canvas/SceneCanvas/coordTrace';
import type { DebugConfig } from '../debug/types';
import type {
  DevtoolsArea, DevtoolsHistoryRecord, DevtoolsOverlays, DevtoolsRegistry, DevtoolsRootInfo,
} from './protocol';

/** What a canvas hands {@link createDevtoolsRoot}. Every getter reads the latest committed value. */
export interface DevtoolsRootSource {
  label(): string;
  readonly dimension: '2d' | '3d';
  scene(): Scene<unknown, string, unknown> | null;
  selection(): readonly string[];
  select(ids: readonly string[]): void;
  view(): unknown;
  activeTool(): string | null;
  tools(): readonly string[];
  setTool(id: string | null): void;
  trace: DispatchTrace;
  coords: TraceRing<CoordTraceEntry>;
  /** The debug sink's stats for the last paint, or null while the frame panel is off. */
  frame(): unknown;
  /** The debug overlay config in effect, or null when the overlay is off. */
  overlays(): DebugConfig | null;
  /** Lay the panel's overlay flags and highlight over the canvas's own `debug`; null drops them. */
  setOverride(override: { overlays: DevtoolsOverlays; highlight: readonly string[] } | null): void;
  /** What the canvas has registered, described when asked. Absent, `get-registry` is refused. */
  registry?(): DevtoolsRegistry;
  /** Hear that what {@link DevtoolsRootSource.registry} describes may have changed. Returns the unsubscribe. */
  subscribeRegistry?(listener: () => void): () => void;
  /** The scene's history steps. Absent, `get-history` is refused. */
  history?: TraceRing<DevtoolsHistoryRecord>;
}

/** One canvas as the devtools hook holds it. */
export interface DevtoolsRoot {
  readonly id: string;
  readonly source: DevtoolsRootSource;
  info(): DevtoolsRootInfo;
  /** Name-keyed probes; the test hook's `registerProbe` writes here. */
  readonly probes: Map<string, () => unknown>;
  version(area: DevtoolsArea): number;
  /** Say that `area` changed. The scene and the trace say so themselves while anything listens. */
  notify(area: DevtoolsArea): void;
  /** Hear each change, with the area. Returns the unsubscribe. */
  subscribe(listener: (area: DevtoolsArea) => void): () => void;
}

let nextId = 1;

/** A root over `source`, with a fresh page-unique id. */
export function createDevtoolsRoot(source: DevtoolsRootSource): DevtoolsRoot {
  const id = `root-${nextId++}`;
  const versions: Record<DevtoolsArea, number> = {
    scene: 0, selection: 0, view: 0, tool: 0, trace: 0, registry: 0, history: 0,
  };
  const listeners = createEmitter<[area: DevtoolsArea]>();
  const notify = (area: DevtoolsArea): void => {
    versions[area]++;
    listeners.emit(area);
  };

  // Attached only while something listens, so a root nobody inspects holds no
  // subscription on a scene that may outlive its canvas.
  let detach: (() => void) | null = null;
  let watchedScene: Scene<unknown, string, unknown> | null = null;
  let offScene: (() => void) | null = null;
  const followScene = (): void => {
    const s = detach ? source.scene() : null;
    if (s === watchedScene) return;
    offScene?.();
    watchedScene = s;
    if (!s) {
      offScene = null;
      return;
    }
    // A selection change notifies the scene's subscribers too; the canvas reports it as `selection`.
    let content = s.getContentVersion();
    offScene = s.subscribe(() => {
      const next = s.getContentVersion();
      if (next === content) return;
      content = next;
      notify('scene');
    });
  };
  const attach = (): void => {
    const offs = [
      source.trace.subscribe(() => notify('trace')),
      source.history?.subscribe(() => notify('history')),
      source.subscribeRegistry?.(() => notify('registry')),
    ];
    detach = () => {
      for (const off of offs) off?.();
      detach = null;
      followScene();
    };
    followScene();
  };

  return {
    id,
    source,
    info: () => ({ id, label: source.label() || id, dimension: source.dimension }),
    probes: new Map(),
    version: (area) => versions[area],
    notify(area) {
      if (area === 'scene') followScene();
      notify(area);
    },
    subscribe(listener) {
      const off = listeners.subscribe(listener);
      if (!detach) attach();
      return () => {
        off();
        if (listeners.size === 0) detach?.();
      };
    },
  };
}
