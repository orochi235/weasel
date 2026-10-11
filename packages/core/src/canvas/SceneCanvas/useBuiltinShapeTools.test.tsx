import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { pathFromD } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from '../sceneAdapter';
import { useBuiltinShapeTools } from './useBuiltinShapeTools';

type PenOptions = {
  wrapPath: (path: unknown, o: { closed: boolean }) => unknown;
  adapter: { makeNode: (carrier: unknown) => { id: string } };
};

const penOptions: PenOptions[] = [];
vi.mock('tools/builtin/pen/usePenTool', () => ({
  usePenTool: (o: PenOptions) => { penOptions.push(o); return { id: 'pen' }; },
}));

type P = { x: number; y: number; width: number; height: number };

describe('useBuiltinShapeTools pen ids', () => {
  it('mints an id a second mount over the same scene does not repeat', () => {
    const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const adapter = sceneToAdapter(scene);
    const mount = () => {
      penOptions.length = 0;
      const { unmount } = renderHook(() => useBuiltinShapeTools({ scene, adapter: adapter as never }));
      const pen = penOptions[penOptions.length - 1];
      const node = pen.adapter.makeNode(pen.wrapPath(pathFromD('M0 0 L10 10'), { closed: false }));
      unmount();
      return node.id;
    };
    expect(mount()).not.toBe(mount());
  });
});
