import { describe, expect, it } from 'vitest';
import { pointInPath, type Path } from '@weasel-js/geom';
import type { RectPose } from '@weasel-js/core';
import { diagramContainerLayout } from './containerLayout';

const C = { id: 'c', bounds: { x: 100, y: 100, width: 200, height: 150 } };
const member = { id: 'm', pose: { x: 150, y: 180, width: 40, height: 20 } };
const title = { id: 'c/title', pose: { x: 0, y: 0, width: 10, height: 10 } };

const regionHas = (layout: ReturnType<typeof diagramContainerLayout>, x: number, y: number) =>
  pointInPath(layout.dropRegion!(C) as Path, x - C.bounds.x, y - C.bounds.y);

describe('diagramContainerLayout', () => {
  it('takes drops in the body below a top header, not in the header', () => {
    const layout = diagramContainerLayout({ header: { side: 'top', size: 30 } });
    expect(regionHas(layout, 150, 110)).toBe(false);
    expect(regionHas(layout, 150, 140)).toBe(true);
  });

  it('takes drops beside a left header', () => {
    const layout = diagramContainerLayout({ header: { side: 'left', size: 30 } });
    expect(regionHas(layout, 110, 200)).toBe(false);
    expect(regionHas(layout, 140, 200)).toBe(true);
  });

  it('leaves members where they are and puts the title in the header', () => {
    const layout = diagramContainerLayout({ header: { side: 'top', size: 30 } });
    const poses = layout.childPoses(C, [member, title]);
    expect(poses.has('m')).toBe(false);
    expect(poses.get('c/title')).toEqual({ x: 100, y: 100, width: 200, height: 30 });
  });

  it('turns the title a quarter to run up a left header', () => {
    const layout = diagramContainerLayout({ header: { side: 'left', size: 30 } });
    const t = layout.childPoses(C, [title]).get('c/title')!;
    expect(t.rotation).toBeCloseTo(-Math.PI / 2);
    expect({ cx: t.x + t.width / 2, cy: t.y + t.height / 2, w: t.width, h: t.height })
      .toEqual({ cx: 115, cy: 175, w: 150, h: 30 });
  });

  it('drops a member where the drag put it, as one transform', () => {
    const layout = diagramContainerLayout();
    const dragged = { id: 'm', originPose: { x: 0, y: 0, width: 40, height: 20 }, pose: member.pose, sourceContainerId: null };
    const targets = layout.getDropTargets(C, [], dragged);
    const target = layout.snap.pickTarget(targets, { x: 170, y: 190 });
    const ops = layout.commitDrop(C, [], dragged, target);
    expect(ops).toHaveLength(1);
    expect((ops[0]!.args as { to: RectPose }).to).toEqual(member.pose);
  });
});
