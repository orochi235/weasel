import { describe, expect, it } from 'vitest';
import { createBusGraph } from './buses';
import { createDelayEffect, createReverbEffect } from './effects';

// The unit tests prove the wiring against a double; these render it through a
// real engine, which is the only place a muted cycle or a dead route shows up.

const RATE = 48000;
const FRAMES = 4800;

/** Render a constant 1 through bus `sfx` of a graph `build` configures, and
 *  return the last sample. An offline context is never running, so every edit
 *  lands at once rather than crossfading. */
async function render(build: (ctx: OfflineAudioContext, graph: ReturnType<typeof createBusGraph>) => void) {
  const ctx = new OfflineAudioContext(1, FRAMES, RATE);
  const graph = createBusGraph(ctx as never, ['sfx']);
  const src = ctx.createConstantSource();
  src.connect(graph.input('sfx'));
  build(ctx, graph);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0)[FRAMES - 1];
}

const halve = (ctx: BaseAudioContext) => {
  const g = ctx.createGain();
  g.gain.value = 0.5;
  return { input: g, output: g };
};

describe('insert chain in a real graph', () => {
  it('passes the signal straight through an empty chain', async () => {
    expect(await render(() => {})).toBeCloseTo(1, 5);
  });

  it('runs the signal through every effect in the chain', async () => {
    const got = await render((ctx, g) => {
      g.bus('sfx').inserts.add(halve(ctx));
      g.bus('sfx').inserts.add(halve(ctx));
    });
    expect(got).toBeCloseTo(0.25, 5);
  });

  it('routes around a bypassed effect', async () => {
    const got = await render((ctx, g) => {
      g.bus('sfx').inserts.add(halve(ctx)).bypass(true);
      g.bus('sfx').inserts.add(halve(ctx));
    });
    expect(got).toBeCloseTo(0.5, 5);
  });

  it('still sounds after a move and a removal', async () => {
    const got = await render((ctx, g) => {
      const chain = g.bus('sfx').inserts;
      const a = chain.add(halve(ctx));
      chain.add(halve(ctx));
      const c = chain.add(halve(ctx));
      c.moveTo(0);
      a.remove();
    });
    expect(got).toBeCloseTo(0.25, 5);
  });

  it('keeps a feedback delay audible: its loop holds a delay, so it is not muted', async () => {
    const got = await render((ctx, g) => {
      g.bus('sfx').inserts.add(createDelayEffect(ctx, { time: 10, feedback: 0.5, mix: 1 }));
    });
    // A constant through a feedback of 0.5 converges on 1 / (1 - 0.5).
    expect(got).toBeCloseTo(2, 1);
  });

  it('convolves with a unit impulse to the dry signal', async () => {
    const got = await render((ctx, g) => {
      const impulse = ctx.createBuffer(1, 1, RATE);
      impulse.getChannelData(0)[0] = 1;
      g.bus('sfx').inserts.add(createReverbEffect(ctx, { impulse, mix: 1, normalize: false }));
    });
    expect(got).toBeCloseTo(1, 3);
  });
});
