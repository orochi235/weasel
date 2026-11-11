import { describe, expect, it } from 'vitest';
import type { SerializedScene } from '@weasel-js/core';
import { nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer } from './snapshot';

const hop = (v: unknown): unknown => reviveTypedArrays(JSON.parse(JSON.stringify(v, serializeReplacer)));

describe('shrunk from the snapshot properties', () => {
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

  it('refuses a snapshot whose node is null with an error naming it', () => {
    const json = { version: 1, systemLayers: [{ id: 'main' }], nodes: [null] } as unknown as SerializedScene<unknown, 'main', unknown>;
    expect(() => nodeSpecsFromSnapshot(json)).toThrow('Scene: malformed snapshot: node 0 is not an object');
    expect(() => nodeSpecsFromSnapshot(json, {}, undefined, { pages: { pages: [] } })).toThrow('Scene: malformed snapshot: node 0 is not an object');
  });

  it('refuses a snapshot whose layers are not a list, or whose saved pages are not pages', () => {
    const layers = { version: 1, systemLayers: {}, nodes: [] } as unknown as SerializedScene<unknown, 'main', unknown>;
    expect(() => nodeSpecsFromSnapshot(layers, {}, undefined, { pages: { pages: [] } })).toThrow(/malformed snapshot: `systemLayers` is not an array/);
    const pages = { version: 3, systemLayers: [{ id: 'main' }], nodes: [], doc: { 'core:pages': { pages: [{ id: 'p' }] } } } as unknown as SerializedScene<unknown, 'main', unknown>;
    expect(() => nodeSpecsFromSnapshot(pages)).toThrow(/core:pages value has page "p" without a finite size/);
  });
});
