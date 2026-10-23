import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import {
  asNodeId,
  createScene,
  inferredNodeProperties,
  inferredNodeRouting,
  pathInWorld,
  shapeGeneratorOf,
  starPath,
  type PolygonPath,
  type SelectionApi,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { renderWithIcons } from '../../testing/withIcons';

type Pose = { x: number; y: number; width: number; height: number };
type Data = { path: PolygonPath; generator?: unknown };

function mount(withGenerator = true) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  const path = starPath({ x: 50, y: 50 }, 50, 4, 25, 0);
  scene.add({
    id: asNodeId('s'),
    kind: 'mark',
    layer: 'default',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { path, ...(withGenerator ? { generator: { kind: 'star', points: 4, innerRadiusRatio: 0.5, rotation: 0 } } : {}) },
  });
  renderWithIcons(
    <SelectionPanel
      scene={scene}
      selection={{ current: ['s'] } as unknown as SelectionApi}
      properties={inferredNodeProperties}
      routing={inferredNodeRouting}
    />,
  );
  const node = () => scene.get(asNodeId('s')) as { pose: Pose; data: Data };
  return { scene, node };
}

describe('a star in the SelectionPanel', () => {
  it('is made again with the point count typed in, as one undo step', () => {
    const { scene, node } = mount();
    const before = node();
    const points = screen.getByLabelText('Points');
    expect(points).toHaveValue('4');
    fireEvent.change(points, { target: { value: '6' } });
    fireEvent.blur(points);
    expect(shapeGeneratorOf(node().data)).toMatchObject({ points: 6 });
    expect((pathInWorld(node().data.path, node().pose) as PolygonPath).coords.length).toBe(6 * 2 * 2);

    act(() => scene.undo());
    expect(node().data).toEqual(before.data);
    expect(node().pose).toEqual(before.pose);
  });

  it('shows no star rows for a path that holds no generator', () => {
    mount(false);
    expect(screen.queryByLabelText('Points')).toBeNull();
  });
});
