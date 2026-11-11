import { describe, expect, it } from 'vitest';
import { createAudioGraph } from './createAudioGraph';
import { createFakeAudioContext } from '../testing/fakeAudioContext';

const own = (ports: string[], ctx: ReturnType<typeof createFakeAudioContext>) => {
  const output = ctx.createGain();
  return { inputs: Object.fromEntries(ports.map((p) => [p, ctx.createGain()])) as never, output: output as never, params: {} };
};

describe('the audio graph, shrunk from the property tests', () => {
  it('replaces a node with one whose port is named like an Object.prototype member', () => {
    const ctx = createFakeAudioContext();
    const graph = createAudioGraph(ctx as never, ctx.destination as never);
    graph.add('a', own(['in'], ctx));
    expect(() => graph.replace('a', own(['toString'], ctx))).not.toThrow();
    graph.add('b', own([], ctx));
    expect(() => graph.connect('b', { node: 'a', port: 'toString' })).not.toThrow();
  });

  it('connects to a port named __proto__', () => {
    const ctx = createFakeAudioContext();
    const graph = createAudioGraph(ctx as never, ctx.destination as never);
    graph.add('a', own(['__proto__'], ctx));
    graph.add('b', own([], ctx));
    expect(() => graph.connect('b', { node: 'a', port: '__proto__' })).not.toThrow();
  });
});
