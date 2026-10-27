import { describe, expect, it } from 'vitest';
import { polygonFromPoints } from '@weasel-js/geom';
import { buildAffordanceAt } from './affordanceAt';
import type { ChromeState } from 'core/selection/chromeState';
import type { NodeId } from 'core/scene/types';
import type { PathEditExtension, PathEditPart } from 'domains/paths/pathEditExtension';

const VIEW = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const PATH = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);

function affordanceAtWith(part: PathEditPart) {
  const extension: PathEditExtension = { id: 'probe', parts: () => [part] };
  return buildAffordanceAt({
    getChromeState: () => ({
      selection: ['p'] as unknown as readonly NodeId[], multiActive: false, boundsOf: () => null, unionBounds: null,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    } as ChromeState),
    getView: () => VIEW,
    getAnchorState: () => ({
      editingId: 'p', getPose: () => PATH, getNode: () => ({ pose: PATH, data: {} }), extensions: [extension],
    }),
  });
}

describe('path-edit extension parts', () => {
  it('are pressed at their standoff, which keeps its screen distance at any zoom', () => {
    // 20px down (0, 1) at 2x is 10 world units below (50, 30).
    const at = affordanceAtWith({ x: 50, y: 30, hitKind: 'probe:0', hitRadiusPx: 4, standoff: { px: 20, normal: { x: 0, y: 1 } } });
    expect(at({ x: 50, y: 40 })?.kind).toBe('probe:0');
    expect(at({ x: 50, y: 30 })).toBeNull();
  });

  it('use their own hit radius, in screen px', () => {
    const at = affordanceAtWith({ x: 50, y: 30, hitKind: 'probe:0', hitRadiusPx: 4 });
    // 1.5 world units is 3px at 2x: inside 4px. 2.5 is 5px: outside.
    expect(at({ x: 51.5, y: 30 })?.kind).toBe('probe:0');
    expect(at({ x: 52.5, y: 30 })).toBeNull();
  });
});
