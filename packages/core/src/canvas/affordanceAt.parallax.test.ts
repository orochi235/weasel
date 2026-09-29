/**
 * Path anchors of a node on a parallax plane are hit where the plane draws
 * them: `anchorStateFrom` hands the hit-test the path in the camera's world.
 */
import { describe, it, expect } from 'vitest';
import { anchorStateFrom, buildAffordanceAt } from './affordanceAt';
import { makeEditAnchorsDep } from 'interactions/actions/testUtils';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { pathFromPlane } from './planeClips';
import type { ChromeState } from 'core/selection/chromeState';

// Sky (plane) = 2 * camera - 100 on x, 2 * camera on y.
const PLANE = { scale: { x: 2, y: 2 }, offset: { x: -100, y: 0 } };

const triangle = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([100, 100, 140, 100, 120, 140]),
  fillRule: 'nonzero',
});

describe('path anchors on a parallax plane', () => {
  it('hits an anchor where the plane draws it', () => {
    const dep = makeEditAnchorsDep({ editingId: 'sun', getEditablePath: () => triangle() });
    const getAnchorState = anchorStateFrom(
      () => ({ get: () => dep }),
      (_id, path) => pathFromPlane(path, PLANE),
    );
    const affordanceAt = buildAffordanceAt({
      getChromeState: () => ({ selection: ['sun'], boundsOf: () => null, multiActive: false, unionBounds: null } as unknown as ChromeState),
      getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
      getAnchorState,
    });
    // Anchor 1 is sky (140,100): camera (120,50).
    expect(affordanceAt({ x: 120, y: 50 })?.kind).toBe('anchor:1');
    expect(affordanceAt({ x: 140, y: 100 })).toBeNull();
  });
});
