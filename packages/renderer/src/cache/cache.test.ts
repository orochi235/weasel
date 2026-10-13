import { describe, it, expect } from 'vitest';
import { pathFromD, setDefaultOpenFill, type RectPath } from '@weasel-js/geom';
import { getMesh, _resetCacheForTests } from './cache';

describe('mesh cache', () => {
  it('returns the same Mesh on subsequent calls with the same Path', () => {
    _resetCacheForTests();
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const a = getMesh(path);
    const b = getMesh(path);
    expect(a).toBe(b);
  });

  it('different Path object identities produce different cache entries', () => {
    // Note: in production, solid-fill rect paths bypass this cache entirely
    // via the rect batch in draw.ts. This test only documents the cache's own
    // identity-keyed behavior.
    _resetCacheForTests();
    const a = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    const b = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    expect(a).not.toBe(b);
  });

  it('rebuilds a mesh cached under another default open-fill rule', () => {
    _resetCacheForTests();
    const open = pathFromD('M0 0 L100 0 L100 100');
    try {
      expect(getMesh(open).indices.length).toBe(3);
      setDefaultOpenFill('none');
      expect(getMesh(open).indices.length).toBe(0);
      expect(getMesh(open)).toBe(getMesh(open));
    } finally {
      setDefaultOpenFill('close');
    }
  });
});
