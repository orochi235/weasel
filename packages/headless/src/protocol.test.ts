import { describe, expect, it } from 'vitest';
import { checkResultBytes, MAX_RESULT_BYTES, readPageRequest, sceneFromWire, sceneToWire } from './protocol';

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

describe('readPageRequest', () => {
  const req = (side: number, format: 'rgba' | 'png') =>
    ({ scene: {}, sourceRect: { x: 0, y: 0, width: side, height: side }, scale: { x: 1, y: 1 }, format });

  it('refuses an RGBA render whose bytes one result cannot carry, before a browser starts', () => {
    expect(() => readPageRequest(req(11_600, 'rgba'))).toThrow(new RegExp(`11600 × 11600 RGBA render is 538240000 bytes, past the ${MAX_RESULT_BYTES}.*tiles`));
    expect(() => readPageRequest(req(10_000, 'rgba'))).not.toThrow();
    // A PNG's size is known only once the page has encoded it.
    expect(() => readPageRequest(req(11_600, 'png'))).not.toThrow();
  });

  it('holds a result to what its base64 and the protocol message around it can be as one string', () => {
    expect(Math.ceil(MAX_RESULT_BYTES / 3) * 4 + 64 * 1024).toBeLessThanOrEqual(2 ** 29 - 24);
    expect(() => checkResultBytes(MAX_RESULT_BYTES, 'a PNG')).not.toThrow();
    expect(() => checkResultBytes(MAX_RESULT_BYTES + 1, 'a PNG')).toThrow(new RegExp(`a PNG is ${MAX_RESULT_BYTES + 1} bytes`));
  });
});
