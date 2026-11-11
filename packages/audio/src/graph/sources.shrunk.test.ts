import { describe, expect, it } from 'vitest';
import { createAudioGraph } from './createAudioGraph';
import { createMixNode } from './processors';
import { createOscillatorNode } from './sources';
import { createFakeAudioContext } from '../testing/fakeAudioContext';

describe('graph nodes, shrunk from the property tests', () => {
  it('gives a mix input named __proto__ its own port and level', () => {
    const def = createMixNode(createFakeAudioContext() as never, { inputs: ['__proto__'] });
    expect(Object.keys(def.inputs)).toEqual(['__proto__']);
    expect(Object.keys(def.params)).toEqual(['__proto__']);
  });

  it('refuses a NaN frequency on a stopped oscillator at the write, not at the next start', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'running';
    const graph = createAudioGraph(ctx as never, ctx.destination as never);
    graph.add('s', createOscillatorNode(ctx as never, {}));
    expect(() => graph.set('s', 'frequency', NaN, 0)).toThrow(RangeError);
    expect(() => graph.start()).not.toThrow();
  });
});
