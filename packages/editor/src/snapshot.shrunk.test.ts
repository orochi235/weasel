import { describe, expect, it } from 'vitest';
import type { SerializedScene } from '@weasel-js/core';
import { nodeSpecsFromSnapshot } from './snapshot';

describe('shrunk from the snapshot properties', () => {
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
