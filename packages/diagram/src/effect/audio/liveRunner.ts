import type { AudioEngine, AudioGraph, GraphPatch } from '@weasel-js/audio';
import type { EffectPipeline, EffectRun } from '../types';
import { audioStageNodes, type AudioSources, type AudioStageNodes } from './nodes';
import { createLivePreviews } from './livePreviews';
import { diffPlans } from './patches';
import { EMPTY_PLAN, livePlan, type LivePlan } from './plan';
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
  /** Unlocks the engine, then starts the graph. */
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
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** Applies the param writes together; when that throws, one by one, to name the stage that failed. */
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
        if (p.kind === 'set') failures[p.id] = messageOf(one);
        break;
      }
    }
  }
}

/** A run holding only `errors`, by stage id. */
export const errorsRun = (errors: Readonly<Record<string, string>>): EffectRun =>
  ({ stages: Object.fromEntries(Object.entries(errors).map(([id, error]) => [id, { error }])) });

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
  const listeners = new Set<() => void>();
  const previews = createLivePreviews();

  const set = (next: Partial<LiveAudioRunnerState>) => {
    const merged = { ...state, ...next };
    if (merged.run === state.run && merged.playing === state.playing) return;
    if (merged.run !== state.run && merged.run !== undefined) previews.track(merged.run);
    state = merged;
    for (const l of [...listeners]) l();
  };
  const publishErrors = (next: Readonly<Record<string, string>>) => {
    if (sameErrors(errors, next)) return;
    errors = next;
    set({ run: errorsRun(next) });
  };

  /** Brings the graph from `from` to the plan `pipeline` and `sources` now give. Structure goes first
   *  in its own apply: a throw there changed nothing, while a throw from the sets means structure landed. */
  const sync = (from: LivePlan) => {
    const next = livePlan(pipeline, nodes, sources);
    const merged: Record<string, string> = { ...next.errors };
    let adopted = next;
    let structural: GraphPatch[] = [];
    let removed: string[] = [];
    let sets: GraphPatch[] = [];
    try {
      const patches = diffPlans(from, next, (_id, n) => nodes[n.type]!.build(engine.context, n.settings, n.levels));
      structural = patches.filter((p) => p.kind !== 'set');
      sets = patches.filter((p) => p.kind === 'set');
      if (structural.length > 0) graph.apply(structural);
      removed = structural.flatMap((p) => (p.kind === 'remove' ? [p.id] : []));
    } catch (err) {
      const message = messageOf(err);
      const id = failingStage(structural, message);
      if (id !== undefined) merged[id] = message;
      console.warn(`@weasel-js/diagram: audio graph edit failed: ${message}`);
      adopted = from;
      sets = [];
    }
    applySets(graph, sets, merged);
    plan = adopted;
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
      await engine.unlock();
      if (disposed) return;
      graph.start();
      set({ playing: true });
    },
    pause() {
      if (disposed) return;
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
      graph.dispose();
      graph = engine.graph(bus);
      previews.restart();
      sync(EMPTY_PLAN);
      set({ playing: false });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      previews.dispose();
      graph.dispose();
    },
  };
}
