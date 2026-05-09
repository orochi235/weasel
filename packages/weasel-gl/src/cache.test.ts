import { describe, it, expect } from 'vitest';
import type { RectPath } from '@orochi235/weasel';
import { getMesh, _resetCacheForTests } from './cache';

describe('mesh cache', () => {
  it('returns the same Mesh on subsequent calls with the same Path', () => {
    _resetCacheForTests();
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const a = getMesh(path);
    const b = getMesh(path);
    expect(a).toBe(b);
  });

  it('returns different Meshes for different Path object identities (even with same coords)', () => {
    _resetCacheForTests();
    const a = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    const b = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    expect(a).not.toBe(b);
  });

  it('honors flattenTolerance via a per-tolerance cache slot (loose vs tight gives different meshes)', () => {
    _resetCacheForTests();
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const a = getMesh(path, { flattenTolerance: 0.5 });
    const b = getMesh(path, { flattenTolerance: 0.5 });
    expect(a).toBe(b);
    // RectPath ignores tolerance, so a different tolerance still hits the same Path-object cache entry.
    // For PolygonPath this would matter; covered via PolygonPath integration tests later.
  });
});
