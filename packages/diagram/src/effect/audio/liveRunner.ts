import type { AudioEngine, AudioGraph, GraphNodeDef, GraphPatch } from '@weasel-js/audio';
import { createEmitter, createLatest, getOwn, setOwn } from '@weasel-js/registry';
import type { EffectPipeline, EffectRun } from '../types';
import { audioStageNodes, type AudioSources, type AudioStageNodes } from './nodes';
import { createLivePreviews, errorsRun } from './livePreviews';
import { diffPlans } from './patches';
import { EMPTY_PLAN, edgeKey, livePlan, type LivePlan, type PlanEdge, type PlanNode } from './plan';
import type { AudioPreview } from './scope';

/** What a live runner last published: its run, and whether it plays. */
export interface LiveAudioRunnerState { run: EffectRun | undefined; playing: boolean }

/** What a live runner plays, and through which engine. */
export interface LiveAudioRunnerOptions {
  engine: AudioEngine;
  pipeline: EffectPipeline;
  nodes?: AudioStageNodes;
  sources?: AudioSources;
  /** The engine bus the graph plays through. */
  bus?: string;
}

/** Plays an audio pipeline through a patchable graph, editing the graph as the pipeline changes. */
export interface LiveAudioRunner {
  readonly state: LiveAudioRunnerState;
  /** The graph follows `pipeline` while it plays, or while it does not. */
  setPipeline(pipeline: EffectPipeline): void;
  /** A new buffer replaces each file node. */
  setSources(sources: AudioSources): void;
  /** Unlocks the engine, then starts the graph, unless a `pause`, `reset` or later `play` came first. */
  play(): Promise<void>;
  pause(): void;
  /** Which stages draw into their `out` preview: a scope, a spectrum, or none. Takes effect on the next `frame`. */
  setPreviews(mode: AudioPreview): void;
  /** Publishes a run with each tapped stage's preview drawn from its tap's current window. */
  frame(): void;
  /** Call after the render that shows `run`: the bitmaps of earlier runs are closed. */
  drawn(run: EffectRun | undefined): void;
  /** A fresh graph holding the current plan, not playing: files start again from 0. */
  reset(): void;
  subscribe(listener: () => void): () => void;
  /** Disposes the graph; the runner does nothing after. The engine is the caller's. */
  dispose(): void;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const idsOf = (p: GraphPatch): string[] =>
  'id' in p ? [p.id] : [p.from, ...('node' in p.to ? [p.to.node] : [])];

/** The stage a failed structural patch names: the one whose id the error message quotes. */
const failingStage = (patches: readonly GraphPatch[], message: string): string | undefined =>
  patches.flatMap(idsOf).find((id) => message.includes(`"${id}"`));

const sameErrors = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k]);
};

/** Applies the param writes together; when that throws, one by one, so the rest land and each failing stage is named. */
function applySets(graph: AudioGraph, sets: readonly GraphPatch[], failures: Record<string, string>): void {
  if (sets.length === 0) return;
  try {
    graph.apply(sets);
  } catch (err) {
    console.warn(`@weasel-js/diagram: audio graph edit failed: ${messageOf(err)}`);
    for (const p of sets) {
      try {
        graph.apply([p]);
      } catch (one) {
        if (p.kind === 'set') setOwn(failures, p.id, messageOf(one));
      }
    }
  }
}

/** `plan` without the nodes in `drop`, the edges touching them, and the edges `cut` names by `edgeKey`. */
function prune(plan: LivePlan, drop: ReadonlySet<string>, cut: ReadonlySet<string>): LivePlan {
  const touches = (e: PlanEdge) => drop.has(e.from) || ('node' in e.to && drop.has(e.to.node));
  return {
    nodes: Object.fromEntries(Object.entries(plan.nodes).filter(([id]) => !drop.has(id))),
    edges: plan.edges.filter((e) => !touches(e) && !cut.has(edgeKey(e))),
    errors: plan.errors,
  };
}

/**
 * `planned` less what cannot go in the graph: a node whose `build` throws, and an edge into a port
 * its node lacks, by the defs built here or, for a node kept, by `ports`. Each is put in `errors`
 * under its stage, and the defs built are returned for the patches to use.
 */
function buildablePlan(
  from: LivePlan, planned: LivePlan, build: (node: PlanNode) => GraphNodeDef,
  ports: ReadonlyMap<string, ReadonlySet<string>>, errors: Record<string, string>,
): { next: LivePlan; defs: Map<string, GraphNodeDef> } {
  const defs = new Map<string, GraphNodeDef>();
  const failed = new Set<string>();
  diffPlans(from, planned, (id, n) => {
    try {
      defs.set(id, build(n));
    } catch (err) {
      failed.add(id);
      setOwn(errors, id, messageOf(err));
    }
    return defs.get(id)!;
  });
  const cut = new Set<string>();
  for (const e of planned.edges) {
    if (!('node' in e.to) || failed.has(e.to.node) || failed.has(e.from)) continue;
    const def = defs.get(e.to.node);
    const has = def !== undefined ? Object.hasOwn(def.inputs, e.to.port) : ports.get(e.to.node)?.has(e.to.port);
    if (has !== false) continue;
    cut.add(edgeKey(e));
    setOwn(errors, e.to.node, `no input port "${e.to.port}"`);
  }
  return { next: failed.size > 0 || cut.size > 0 ? prune(planned, failed, cut) : planned, defs };
}

/**
 * Applies the structural patches, and whether they landed: a batch the graph refuses changes nothing,
 * and one that passes its check lands though a source in it fails to start.
 */
function applyStructure(graph: AudioGraph, structural: readonly GraphPatch[], errors: Record<string, string>): boolean {
  if (structural.length === 0) return true;
  const fail = (err: unknown) => {
    const message = messageOf(err);
    const id = failingStage(structural, message);
    if (id !== undefined) setOwn(errors, id, message);
    console.warn(`@weasel-js/diagram: audio graph edit failed: ${message}`);
  };
  try {
    graph.check(structural);
  } catch (err) {
    fail(err);
    return false;
  }
  try {
    graph.apply(structural);
  } catch (err) {
    fail(err);
  }
  return true;
}

/** A runner over `opts.pipeline` holding a fresh graph on `opts.engine`, not playing. */
export function createLiveAudioRunner(opts: LiveAudioRunnerOptions): LiveAudioRunner {
  const { engine, bus } = opts;
  const nodes = opts.nodes ?? audioStageNodes;
  let pipeline = opts.pipeline;
  let sources: AudioSources = opts.sources ?? {};
  let graph: AudioGraph = engine.graph(bus);
  let plan: LivePlan = EMPTY_PLAN;
  let errors: Readonly<Record<string, string>> = {};
  let state: LiveAudioRunnerState = { run: { stages: {} }, playing: false };
  let disposed = false;
  /** Taken by every play and dropped by pause and reset, so a play whose unlock a later one overtook starts nothing. */
  const transport = createLatest();
  const listeners = createEmitter();
  const previews = createLivePreviews();

  const set = (next: Partial<LiveAudioRunnerState>) => {
    const merged = { ...state, ...next };
    if (merged.run === state.run && merged.playing === state.playing) return;
    if (merged.run !== state.run && merged.run !== undefined) previews.track(merged.run);
    state = merged;
    listeners.emit();
  };
  const publishErrors = (next: Readonly<Record<string, string>>) => {
    if (sameErrors(errors, next)) return;
    errors = next;
    set({ run: errorsRun(next) });
  };

  /** The input ports of each node in the graph, from the def it was built with. */
  const ports = new Map<string, ReadonlySet<string>>();

  /** Brings the graph from `from` to the plan `pipeline` and `sources` now give. Structure goes first
   *  in its own apply; a throw from the sets means structure landed. */
  const sync = (from: LivePlan) => {
    const planned = livePlan(pipeline, nodes, sources);
    const merged: Record<string, string> = { ...planned.errors };
    const { next, defs } = buildablePlan(from, planned, (n) => getOwn(nodes, n.type)!.build(engine.context, n.settings, n.levels), ports, merged);
    const patches = diffPlans(from, next, (id) => defs.get(id)!);
    const structural = patches.filter((p) => p.kind !== 'set');
    const landed = applyStructure(graph, structural, merged);
    const adopted = landed ? next : from;
    const sets = landed ? patches.filter((p) => p.kind === 'set') : [];
    applySets(graph, sets, merged);
    plan = adopted;
    if (adopted === next) {
      for (const id of ports.keys()) if (!Object.hasOwn(next.nodes, id)) ports.delete(id);
      for (const [id, def] of defs) ports.set(id, new Set(Object.keys(def.inputs)));
    }
    const removed = adopted === next ? structural.flatMap((p) => (p.kind === 'remove' ? [p.id] : [])) : [];
    previews.follow(graph, removed, Object.keys(adopted.nodes));
    publishErrors(merged);
  };

  sync(EMPTY_PLAN);

  return {
    get state() { return state; },
    setPipeline(next) {
      if (disposed) return;
      pipeline = next;
      sync(plan);
    },
    setSources(next) {
      if (disposed) return;
      sources = next;
      sync(plan);
    },
    async play() {
      if (disposed) return;
      const newest = transport.take();
      await engine.unlock();
      if (disposed || !newest()) return;
      graph.start();
      set({ playing: true });
    },
    pause() {
      if (disposed) return;
      transport.drop();
      graph.stop();
      set({ playing: false });
    },
    setPreviews(mode) {
      if (disposed) return;
      previews.setMode(mode, graph, Object.keys(plan.nodes));
      if (mode === 'off') set({ run: errorsRun(errors) });
    },
    frame() {
      if (disposed) return;
      const run = previews.draw(errors);
      if (run !== undefined) set({ run });
    },
    drawn: previews.drawn,
    reset() {
      if (disposed) return;
      transport.drop();
      graph.dispose();
      graph = engine.graph(bus);
      previews.restart();
      sync(EMPTY_PLAN);
      set({ playing: false });
    },
    subscribe: listeners.subscribe,
    dispose() {
      if (disposed) return;
      disposed = true;
      previews.dispose();
      graph.dispose();
    },
  };
}
