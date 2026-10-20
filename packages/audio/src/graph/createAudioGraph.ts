import { createAnalyserTap } from '../analyser';
import { defaultTimers, type Timers } from '../audioTime';
import { writeParam } from '../param';
import { createEdits, graphError } from './edits';
import { createTransport } from './transport';
import type { AudioGraph, AudioGraphOptions } from './types';
import { startWrapper } from './wrapper';

export type { NodeWrapper } from './wrapper';

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
  output.gain.value = 1;
  writeParam(ctx, output.gain, 1);
  output.connect(destination);

  let waiters: (() => void)[] = [];
  let disposed = false;
  const onSettle = (): void => {
    if (!disposed && (edits.closing() || transport.stopping())) return;
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

  const graph: AudioGraph = {
    add: edits.add,
    remove: edits.remove,
    replace() {
      throw graphError('replace is not yet supported');
    },
    connect: edits.connect,
    disconnect: edits.disconnect,
    set: edits.set,
    apply(patches) {
      for (const p of patches) {
        switch (p.kind) {
          case 'add': graph.add(p.id, p.def); break;
          case 'remove': graph.remove(p.id); break;
          case 'replace': graph.replace(p.id, p.def); break;
          case 'connect': graph.connect(p.from, p.to); break;
          case 'disconnect': graph.disconnect(p.from, p.to); break;
          case 'set': graph.set(p.id, p.param, p.value, p.rampMs); break;
        }
      }
    },
    start: transport.start,
    stop: transport.stop,
    playing: transport.playing,
    has: edits.has,
    ids: edits.ids,
    tap(id, tapOpts) {
      const w = edits.live(id);
      const t = createAnalyserTap(ctx, w.out, tapOpts);
      w.taps.add(t);
      return t;
    },
    settled() {
      return new Promise((resolve) => {
        waiters.push(resolve);
        onSettle();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      transport.dispose();
      edits.dispose();
      output.disconnect();
      onSettle();
    },
  };
  return graph;
}
