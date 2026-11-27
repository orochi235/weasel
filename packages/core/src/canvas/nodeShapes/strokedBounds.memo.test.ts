import { describe, it, expect, vi } from 'vitest';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import { INHERIT, solidStroke } from '@weasel-js/paint';
import * as stroke from '@weasel-js/stroke';
import { pathFromParts } from 'core/scene/derivedParts';
import { PATH_POSE_PAINTER } from './pathPosePainter';
import { DERIVED_PAINTER } from './derivedPainter';

vi.mock('@weasel-js/stroke', async (original) => {
  const real = await original<typeof import('@weasel-js/stroke')>();
  return { ...real, tessellateStroke: vi.fn(real.tessellateStroke) };
});

const TRIANGLE: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);
const STROKE = solidStroke('#000', 4);
const tessellated = () => vi.mocked(stroke.tessellateStroke).mock.calls.length;

describe('the drawn box of a stroked path, asked again', () => {
  it('does not stroke an unchanged path-posed node again', () => {
    const node = { id: 'p', kind: 'mark', pose: TRIANGLE, data: { stroke: STROKE } };
    const first = PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 2 });
    const before = tessellated();
    expect(PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 2 })).toEqual(first);
    expect(tessellated()).toBe(before);
    PATH_POSE_PAINTER.drawnBounds!(node as never, TRIANGLE, { scale: 3 });
    expect(tessellated()).toBe(before + 1);
  });

  it('does not stroke an unchanged derived node again', () => {
    const node = { id: 'd', data: { stroke: STROKE }, dependsOn: ['a'] };
    const ctx = { derivedPath: pathFromParts([
      { path: TRIANGLE, stroke: INHERIT },
      { path: polygonFromPoints([{ x: 0, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }]), stroke: INHERIT },
    ])! };
    const first = DERIVED_PAINTER.drawnBounds!(node as never, null as never, ctx);
    const before = tessellated();
    expect(DERIVED_PAINTER.drawnBounds!(node as never, null as never, ctx)).toEqual(first);
    expect(before).toBeGreaterThan(0);
    expect(tessellated()).toBe(before);
  });
});
