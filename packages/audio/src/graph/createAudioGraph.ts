import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from '../analyser';
import { defaultTimers, type Timers } from '../audioTime';
import { initParam } from '../param';
import { createEdits } from './edits';
import { graphError } from './errors';
import { createTransport } from './transport';
import type { AudioGraph, AudioGraphOptions, GraphNodeDef, GraphPatch } from './types';
import { validatePatches } from './validate';
import { startWrapper } from './wrapper';

export type { NodeWrapper } from './wrapper';

const teardowns = new WeakMap<AudioGraph, () => void>();

/** Internal: tear `graph` down now, with no fade, as `dispose` would on a silent graph. */
export function disposeNow(graph: AudioGraph): void {
  teardowns.get(graph)?.();
}

/**
 * A patchable graph of node defs feeding `destination`. Every structural edit
 * fades: a connection opens through its own gain and closes through it before
 * the cut, and a removed node leaves once its edges have closed.
 */
export function createAudioGraph(
  ctx: BaseAudioContext,
  destination: AudioNode,
  opts: AudioGraphOptions = {},
): AudioGraph {
  const fadeMs = opts.fadeMs ?? 15;
  const timers: Timers = {
    setTimer: opts.setTimer ?? defaultTimers.setTimer,
    clearTimer: opts.clearTimer ?? defaultTimers.clearTimer,
  };
  const fade = (): number => (ctx.state === 'running' ? fadeMs : 0);

  const output = ctx.createGain();
  initParam(ctx, output.gain, 0);
  output.connect(destination);

  let waiters: (() => void)[] = [];
  let disposed = false;
  let torn = false;
  const onSettle = (): void => {
    if (!torn && (edits.busy() || transport.busy())) return;
    const done = waiters;
    waiters = [];
    for (const w of done) w();
  };

  const edits = createEdits({
    ctx, timers, fade, output, onSettle,
    onAdd: (w) => { if (transport.playing()) startWrapper(w, ctx.currentTime); },
  });
  const transport = createTransport({
    ctx, timers, fade, output, onSettle, live: edits.liveNodes, all: edits.allNodes,
  });
  const guard = <A extends unknown[], R>(f: (...args: A) => R) => (...args: A): R => {
    if (disposed) throw graphError('graph is disposed');
    return f(...args);
  };

  const graph: AudioGraph = {
    add: guard(edits.add),
    remove: guard(edits.remove),
    replace: guard((id: string, def: GraphNodeDef): void => {
      edits.replace(id, def, transport.playing());
    }),
    connect: guard(edits.connect),
    disconnect: guard(edits.disconnect),
    set: guard(edits.set),
    apply: guard((patches: readonly GraphPatch[]): void => {
      validatePatches(edits.view(), patches);
      let failed: { error: unknown } | null = null;
      for (const p of patches) {
        switch (p.kind) {
          case 'add': graph.add(p.id, p.def); break;
          case 'remove': graph.remove(p.id); break;
          case 'replace': graph.replace(p.id, p.def); break;
          case 'connect': graph.connect(p.from, p.to); break;
          case 'disconnect': graph.disconnect(p.from, p.to); break;
          case 'set':
            try {
              graph.set(p.id, p.param, p.value, p.rampMs);
            } catch (error) {
              failed ??= { error };
            }
            break;
        }
      }
      if (failed) throw failed.error;
    }),
    start: guard(transport.start),
    stop: guard(transport.stop),
    playing: transport.playing,
    has: edits.has,
    ids: edits.ids,
    tap: guard((id: string, tapOpts?: AnalyserTapOptions): AnalyserTap => {
      const w = edits.live(id);
      const t = createAnalyserTap(ctx, w.out, tapOpts);
      w.taps.add(t);
      return t;
    }),
    settled() {
      return new Promise((resolve) => {
        waiters.push(resolve);
        onSettle();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (ctx.state === 'running' && transport.audible()) transport.fadeOut(teardown);
      else teardown();
    },
  };
  const teardown = (): void => {
    if (torn) return;
    disposed = true;
    torn = true;
    transport.dispose();
    edits.dispose();
    output.disconnect();
    onSettle();
  };
  teardowns.set(graph, teardown);
  return graph;
}
