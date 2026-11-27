import { describe, expect, it, vi } from 'vitest';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import { solidStroke } from '@weasel-js/paint';
import { tessellateStroke } from '@weasel-js/stroke';
import { pathFromParts } from 'core/scene/derivedParts';
import { PATH_POSE_PAINTER } from './pathPosePainter';
import { DERIVED_PAINTER } from './derivedPainter';

vi.mock('@weasel-js/stroke', async (original) => {
  const actual = await original<typeof import('@weasel-js/stroke')>();
  return { ...actual, tessellateStroke: vi.fn(actual.tessellateStroke) };
});

const TRIANGLE: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);
const stroke = solidStroke('#000', 4);

/** How many times `read` strokes a path, on its second call after a first. */
function strokesOnRepeat(read: () => unknown): number {
  read();
  const before = vi.mocked(tessellateStroke).mock.calls.length;
  read();
  return vi.mocked(tessellateStroke).mock.calls.length - before;
}

describe('a drawn box read again with nothing changed', () => {
  it('does not stroke a path-posed node again', () => {
    const node = { id: 'p', data: { stroke } };
    expect(strokesOnRepeat(() => PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 1 }))).toBe(0);
  });

  it('does not stroke a derived path again, whole or in parts', () => {
    const node = { id: 'd', data: { stroke }, dependsOn: ['a'] };
    const pose = { x: 0, y: 0, width: 0, height: 0 } as never;
    expect(strokesOnRepeat(() => DERIVED_PAINTER.drawnBounds!(node as never, pose, { derivedPath: TRIANGLE, screen: [1, 0, 0, 1] }))).toBe(0);
    const parts = pathFromParts([{ path: TRIANGLE, stroke }])!;
    expect(strokesOnRepeat(() => DERIVED_PAINTER.drawnBounds!(node as never, pose, { derivedPath: parts }))).toBe(0);
  });

  it('strokes it again for a new stroke or scale', () => {
    const node = { id: 'p', data: { stroke } };
    PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 1 });
    const before = vi.mocked(tessellateStroke).mock.calls.length;
    const wide = PATH_POSE_PAINTER.drawnBounds!({ id: 'p', data: { stroke: solidStroke('#000', 40) } } as never, TRIANGLE, { scale: 1 })!;
    PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 2 });
    expect(vi.mocked(tessellateStroke).mock.calls.length - before).toBe(2);
    expect(wide.x).toBeLessThan(-10);
  });
});
