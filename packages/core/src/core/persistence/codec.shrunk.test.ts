import { describe, expect, it } from 'vitest';
import { parseSnapshot, stringifySnapshot } from './codec';

const hop = (v: unknown): unknown => parseSnapshot(stringifySnapshot(v));

describe('shrunk from the snapshot codec properties', () => {
  it('reads back a plain object shaped like a tagged typed array as itself', () => {
    expect(hop({ __ta: 'u8', data: [] })).toEqual({ __ta: 'u8', data: [] });
  });

  it('reads back plain data under a path key as itself, where an older save\'s path would be revived', () => {
    const data = { commands: { commands: {} }, coords: [0.1, 2], polyline: { coords: [null] } };
    const back = hop(data) as typeof data;
    expect(back).toEqual(data);
    expect(Array.isArray(back.coords)).toBe(true);
  });

  it('reads back a value shaped like its own wrapper', () => {
    expect(hop({ __raw: { __raw: 1 } })).toEqual({ __raw: { __raw: 1 } });
  });
});
