import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '../createAudioEngine';
import type { AudioEngineOptions } from '../types';
import { renderEngineStereo } from '../testing/renderEngine';
import { rms } from '../testing/spectrum';
import { createGainNode, delayNode } from './processors';
import { createFileSourceNode, createOscillatorNode } from './sources';
import type { AudioGraph } from './types';

// The unit tests prove the wiring against a double; these render it through a
// real engine. The fade cuts wait on the audio clock and may land after the
// render ends; what is heard is the param ramp, which renders exactly.

const RATE = 48000;
const ms = (t: number) => Math.round((t / 1000) * RATE);
/** Hz. At 0.2 s it is 90.4 cycles in, far from a zero crossing, so a cut there would step. */
const OFF_ZERO = 452;
/** A render pauses on a 128-frame block edge: 4608 frames is exactly 96 ms, where 100 ms would land late. */
const START_MS = 96;
const START = START_MS / 1000;

/** Render a graph on the engine's first bus; `later` runs with the render held at `at` seconds. */
async function renderGraph(
  seconds: number,
  build: (graph: AudioGraph, engine: AudioEngine) => void,
  later?: { at: number; run: (graph: AudioGraph, engine: AudioEngine) => void },
  opts: Pick<AudioEngineOptions, 'insertFadeMs'> = {},
): Promise<Float32Array> {
  let graph: AudioGraph | null = null;
  const [left] = await renderEngineStereo(seconds, (e) => {
    graph = e.graph();
    build(graph, e);
  }, RATE, opts, later && { at: later.at, run: (e) => later.run(graph!, e) });
  return left;
}

function maxStep(x: Float32Array, from: number, to: number): number {
  let m = 0;
  for (let i = from + 1; i < to; i += 1) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
}

function maxAbs(x: Float32Array, from: number, to = x.length): number {
  let m = 0;
  for (let i = from; i < to; i += 1) m = Math.max(m, Math.abs(x[i]));
  return m;
}

/** A 20 ms burst of seeded noise, the same in every render. */
function burst(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ms(20), RATE);
  const d = buf.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < d.length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    d[i] = seed / 2 ** 31 - 1;
  }
  return buf;
}

describe('audio graph in a real engine', () => {
  it('sounds: an oscillator through a gain reaches the bus', async () => {
    const out = await renderGraph(0.5, (g, e) => {
      g.add('osc', createOscillatorNode(e.context, { frequency: 440 }));
      g.add('amp', createGainNode(e.context, { gain: 0.5 }));
      g.connect('osc', { node: 'amp', port: 'in' });
      g.connect('amp', { output: true });
      g.start();
    });
    // A mono graph into a bus has no panner: it is up-mixed to both channels at full gain.
    const ratio = rms(out, ms(100), ms(400)) / (0.5 * Math.SQRT1_2);
    expect(Math.abs(ratio - 1)).toBeLessThan(0.1);
  });

  it('the first start fades in rather than stepping', async () => {
    // Connected well before start(), so the edge's own fade-in is over and only the output's hides the step.
    const play = (insertFadeMs?: number) => renderGraph(0.3, (g, e) => {
      g.add('osc', createOscillatorNode(e.context, { wave: 'square', frequency: OFF_ZERO }));
      g.connect('osc', { output: true });
    }, { at: START, run: (g) => g.start() }, insertFadeMs === undefined ? {} : { insertFadeMs });
    const faded = await play();
    const cut = await play(0);
    const peak = maxAbs(faded, ms(200), ms(300));
    expect(maxStep(faded, ms(START_MS) - 1, ms(START_MS + 1))).toBeLessThan(peak / 3);
    // The same measure on an unfaded start, which must see the step.
    expect(maxStep(cut, ms(START_MS) - 1, ms(START_MS + 1))).toBeGreaterThan(peak / 3);
  });

  it("patching a running graph doesn't reset a delay's tail", async () => {
    const build = (g: AudioGraph, e: AudioEngine): void => {
      g.add('src', createFileSourceNode(e.context, { buffer: burst(e.context), loop: false }));
      g.add('delay', delayNode(e.context, { time: 100, feedback: 0.5, mix: 1 }));
      g.connect('src', { node: 'delay', port: 'in' });
      g.connect('delay', { output: true });
      g.start();
    };
    const untouched = await renderGraph(0.4, build);
    const patched = await renderGraph(0.4, build, {
      at: 0.15,
      run: (g, e) => g.apply([
        { kind: 'add', id: 'x', def: createGainNode(e.context) },
        { kind: 'connect', from: 'src', to: { node: 'x', port: 'in' } },
        { kind: 'set', id: 'delay', param: 'mix', value: 1 },
      ]),
    });
    for (const at of [200, 300]) {
      const a = rms(untouched, ms(at), ms(at + 20));
      const b = rms(patched, ms(at), ms(at + 20));
      expect(a).toBeGreaterThan(0.01);
      expect(Math.abs(a - b) / a).toBeLessThan(0.01);
    }
  });

  it('removing a node fades rather than cuts', async () => {
    const out = await renderGraph(0.4, (g, e) => {
      g.add('osc', createOscillatorNode(e.context, { frequency: OFF_ZERO }));
      g.connect('osc', { output: true });
      g.start();
    }, { at: 0.2, run: (g) => g.remove('osc') });
    const steady = maxStep(out, ms(100), ms(200));
    expect(maxStep(out, ms(199), ms(215))).toBeLessThan(steady * 1.1);
    expect(maxAbs(out, ms(250))).toBeLessThan(1e-4);
  });

  it('replace crossfades a wave change', async () => {
    const out = await renderGraph(0.5, (g, e) => {
      g.add('osc', createOscillatorNode(e.context, { frequency: OFF_ZERO }));
      g.connect('osc', { output: true });
      g.start();
    }, {
      at: 0.2,
      run: (g, e) => g.replace('osc', createOscillatorNode(e.context, { wave: 'square', frequency: OFF_ZERO })),
    });
    // A crossfade's step is bounded by the louder-stepping of its two signals.
    const square = maxStep(out, ms(300), ms(400));
    const steady = Math.max(maxStep(out, ms(100), ms(200)), square);
    expect(maxStep(out, ms(195), ms(230))).toBeLessThan(steady * 1.1);
    // A square is all steps, so the bound above would pass a hard switch too.
    // Over the 15 ms fade's first third its edges are at most a third their size.
    expect(maxStep(out, ms(199), ms(205))).toBeLessThan(square * 0.5);
  });
});
