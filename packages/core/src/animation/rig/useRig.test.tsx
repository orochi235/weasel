import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createScene } from '../../core/scene/scene';
import type { RectPose } from '../../core/scene/types';
import { useRig } from './useRig';
import type { Rig } from './bindRig';
import type { Skeleton } from './types';

const SKELETON: Skeleton = {
  joints: [{ name: 'root', parent: null, bind: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }],
};

describe('useRig', () => {
  it('keeps one rig across renders and drops its overrides on unmount', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const bindings = { root: id };
    const seen: Rig[] = [];
    function Probe() {
      seen.push(useRig({ scene, skeleton: SKELETON, bindings }));
      return null;
    }
    const { rerender, unmount } = render(<Probe />);
    rerender(<Probe />);
    expect(seen[0]).toBe(seen[seen.length - 1]);
    seen[0].pose({ root: { x: 5 } });
    expect(scene.overrides.has(id)).toBe(true);
    unmount();
    expect(scene.overrides.has(id)).toBe(false);
  });
});
