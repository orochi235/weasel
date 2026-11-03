import { describe, expect, it } from 'vitest';
import type { LayoutChild, LayoutContainer } from '../../layout/types';
import type { RectPose } from '../scene/types';
import { pageRunLayout } from './pageRunLayout';

const rect = (width: number, height: number): RectPose => ({ x: 0, y: 0, width, height });
const page = (id: string, pose: RectPose): LayoutChild<RectPose> => ({ id, pose, node: { page: {} } as never });

describe('pageRunLayout', () => {
  const container = (pageRun: object): LayoutContainer => ({
    id: 'run', bounds: { x: 7, y: 3, width: 0, height: 0 }, node: { pageRun } as never,
  });

  it('places the run\'s pages from its origin, by its settings', () => {
    const placed = pageRunLayout().childPoses(
      container({ direction: 'column', gap: 5, align: 'center' }),
      [page('a', rect(100, 20)), page('b', rect(50, 20))],
    );
    expect(placed.get('a')).toEqual({ x: 7, y: 3, width: 100, height: 20 });
    expect(placed.get('b')).toEqual({ x: 32, y: 28, width: 50, height: 20 });
  });

  it('leaves alone a child that is not a page', () => {
    const follower: LayoutChild<RectPose> = { id: 'link', pose: rect(0, 0), node: {} as never };
    const placed = pageRunLayout().childPoses(container({}), [follower, page('a', rect(10, 10))]);
    expect([...placed.keys()]).toEqual(['a']);
  });
});
