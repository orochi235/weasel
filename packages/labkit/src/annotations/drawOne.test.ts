import type { SceneNode, View } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { createMarkDrawOne } from './drawOne';
import type { WorldRect } from './frac';
import type { AnnotationData } from './types';

const CONTENT = { w: 100, h: 60 };
const VIEW = { x: 0, y: 0, zoom: 1 } as unknown as View;

const node = (data: Partial<AnnotationData>, pose: WorldRect) =>
  ({
    id: 'n1',
    kind: 'leaf',
    layer: 'marks',
    pose,
    data: { target: 'flat', kind: 'rect', ...data } as AnnotationData,
  }) as unknown as SceneNode<AnnotationData, 'marks', WorldRect>;

const strokeOf = (cmds: ReturnType<ReturnType<typeof createMarkDrawOne>>) => {
  const first = cmds[0];
  if (first?.kind !== 'path') throw new Error('expected a path command');
  return first.stroke;
};

describe('the draw callback marks share between the screen and an export', () => {
  it("paints a mark in its status's colour", () => {
    const drawOne = createMarkDrawOne({
      content: CONTENT,
      config: {},
      meaning: { statuses: [{ id: 'fixed', label: 'Fixed', color: '#30a46c' }] },
    });
    const n = node({ status: 'fixed' }, { x: 1, y: 2, width: 3, height: 4 });
    expect(strokeOf(drawOne(n, n.pose, VIEW))?.paint).toEqual({ color: '#30a46c' });
  });

  it('dashes a mark whose position no longer describes the picture', () => {
    const drawOne = createMarkDrawOne({
      content: CONTENT,
      positionDependsOn: ['angle'],
      config: { angle: 30 },
    });
    const fresh = node({ seen: { angle: 30 } }, { x: 1, y: 2, width: 3, height: 4 });
    const stale = node({ seen: { angle: 0 } }, { x: 1, y: 2, width: 3, height: 4 });
    expect(strokeOf(drawOne(fresh, fresh.pose, VIEW))?.dash).toBeUndefined();
    expect(strokeOf(drawOne(stale, stale.pose, VIEW))?.dash).toEqual([6, 4]);
  });

  it('draws at the pose the walk resolved, not the one the node was stored with', () => {
    const drawOne = createMarkDrawOne({ content: CONTENT, config: {} });
    const n = node({}, { x: 1, y: 2, width: 3, height: 4 });
    const cmds = drawOne(n, { x: 50, y: 60, width: 10, height: 10 }, VIEW);
    const first = cmds[0];
    if (first?.kind !== 'path') throw new Error('expected a path command');
    expect(JSON.stringify(first.path)).toContain('50');
  });
});
