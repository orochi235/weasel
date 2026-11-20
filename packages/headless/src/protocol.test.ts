import { describe, expect, it } from 'vitest';
import { sceneFromWire, sceneToWire } from './protocol';

describe('sceneToWire', () => {
  it("sends a live scene's data as it holds it, even where it is shaped like the codec's tags", () => {
    const data = {
      coords: [0.1, 16777217],
      commands: [1, 2],
      tag: { __num: 'NaN' },
      tagged: { __ta: 'Float64Array', data: [1] },
      raw: { __raw: { a: 1 } },
    };
    const live = { toJSON: () => ({ nodes: [{ id: 'a', data }] }) };
    const back = sceneFromWire(JSON.parse(JSON.stringify(sceneToWire(live))) as object);
    expect(back).toEqual({ nodes: [{ id: 'a', data }] });
  });
});
