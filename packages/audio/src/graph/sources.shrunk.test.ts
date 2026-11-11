import { describe, expect, it } from 'vitest';
import { createMixNode } from './processors';
import { createFakeAudioContext } from '../testing/fakeAudioContext';

describe('graph nodes, shrunk from the property tests', () => {
  it('gives a mix input named __proto__ its own port and level', () => {
    const def = createMixNode(createFakeAudioContext() as never, { inputs: ['__proto__'] });
    expect(Object.keys(def.inputs)).toEqual(['__proto__']);
    expect(Object.keys(def.params)).toEqual(['__proto__']);
  });
});
