/**
 * The `inspection` dep: what a canvas tells a plug-in that inspects it and
 * not its actions — the label its host gives it, its tools and what
 * registered them, the debug flags in effect, its `clientToWorld` conversions,
 * its test probes — and when they change. `@weasel-js/devtools` reads it from a contribution's `attach`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createEmitter } from '@weasel-js/registry';
import { createTraceRing, type ActionsRegistry, type Contribution, type DepRegistry, type TraceRing } from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { Scene } from 'core/scene/types';
import type { DebugFlags } from '../../debug/types';
import { resolveDebugFlags } from '../../debug/parseDebugFlags';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CoordTraceEntry } from '../SceneCanvas/coordTrace';
import { inferredNodeRouting } from '../SceneCanvas/defaultNodeRouting';
import { useDevtoolsLabel } from '../devtoolsLabel';

/** What moved, as {@link CanvasInspection.subscribe} reports it. A view change is the canvas api's `subscribeView`. */
export type CanvasInspectionChange = 'scene' | 'selection' | 'tool' | 'registry';

/** One canvas as an inspector reads it. Every getter reads the latest render. */
export interface CanvasInspection {
  /** The name the nearest `<DevtoolsLabel>` above the canvas gives, or null outside one. */
  label(): string | null;
  /** The tools the canvas routes input through, the active one among them. */
  tools(): ToolsApi;
  /** The entries the canvas's `features` presets brought beside its tools. */
  contributions(): readonly Contribution<unknown>[];
  /** The node kinds a binding's `kind:` target can name, in classify order. */
  routingKinds(): readonly string[];
  /** The canvas's actions registry, or null where no `<ActionsProvider>` is mounted. */
  actions(): ActionsRegistry | null;
  /** The canvas's dep registry. */
  deps(): DepRegistry;
  /** The debug overlay config in effect, or null while the overlay is off. */
  debug(): DebugFlags | null;
  /** Lay `flags` over the canvas's own `debug` prop; null drops them. */
  setDebugOverride(flags: DebugFlags | null): void;
  /** The canvas's `clientToWorld` conversions, kept from the first call on. */
  coords(): TraceRing<CoordTraceEntry>;
  /** The test hook's named probes. */
  readonly probes: ReadonlyMap<string, () => unknown>;
  /** Hear each change. Returns the unsubscribe. */
  subscribe(listener: (change: CanvasInspectionChange) => void): () => void;
}

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** The canvas as an inspector reads it. Sourced by `<SceneCanvas>`. */
    inspection?: CanvasInspection;
  }
}

/** What {@link useCanvasInspection} reads, from the latest render. */
export interface CanvasInspectionInputs {
  scene: Scene<unknown, string, unknown>;
  selection: readonly string[] | undefined;
  tools: ToolsApi;
  contributions: readonly Contribution<unknown>[];
  routing: readonly NodeRoutingEntry[] | undefined;
  debug: DebugFlags | false | undefined;
  setDebugOverride(flags: DebugFlags | null): void;
}

/**
 * Sources the canvas's `inspection` dep. Returns the probes the test hook
 * writes and a reader for the coord trace, which is null until an inspector
 * asks for one: a canvas nothing inspects keeps no trace.
 */
export function useCanvasInspection(inputs: CanvasInspectionInputs): {
  probes: Map<string, () => unknown>;
  coords: () => TraceRing<CoordTraceEntry> | null;
} {
  const live = useLatest(inputs);
  const actions = useActionsRegistry();
  const deps = useDepRegistry();
  const registries = useLatest({ actions, deps, label: useDevtoolsLabel() });
  const coordsRef = useRef<TraceRing<CoordTraceEntry> | null>(null);
  const [readCoords] = useState(() => () => coordsRef.current);
  const [probes] = useState(() => new Map<string, () => unknown>());
  const [changes] = useState(() => createEmitter<[CanvasInspectionChange]>());
  const inspection = useMemo<CanvasInspection>(() => ({
    label: () => registries.current.label,
    tools: () => live.current.tools,
    contributions: () => live.current.contributions,
    routingKinds: () => (live.current.routing ?? inferredNodeRouting).map((k) => k.name),
    actions: () => registries.current.actions,
    deps: () => registries.current.deps,
    debug: () => resolveDebugFlags(live.current.debug),
    setDebugOverride: (flags) => live.current.setDebugOverride(flags),
    coords: () => (coordsRef.current ??= createTraceRing<CoordTraceEntry>()),
    probes,
    subscribe: changes.subscribe,
  }), [live, registries, probes, changes]);
  useDepSource('inspection', () => inspection);

  const { scene, selection, tools: { active, registry, ambient }, contributions, routing } = inputs;
  useEffect(() => { changes.emit('scene'); }, [changes, scene]);
  useEffect(() => { changes.emit('selection'); }, [changes, selection]);
  useEffect(() => { changes.emit('tool'); }, [changes, active]);
  useEffect(() => { changes.emit('registry'); }, [changes, registry, ambient, contributions, routing]);
  return { probes, coords: readCoords };
}
