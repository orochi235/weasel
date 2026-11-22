import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { worldPoseOf, type Scene, type View } from '@weasel-js/core';
import { LevelOfDetailDemo } from '../LevelOfDetailDemo';

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, unknown> | null, views: [] as View[] }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts);
      held.scene = scene as never;
      return scene;
    },
    SceneCanvas: (props: object) =>
      createElement(core.SceneCanvas, { ...props, onViewChange: (v: View) => held.views.push(v) } as never),
  };
});

afterEach(cleanup);

type Rect = { x: number; y: number; width: number; height: number };

describe('LevelOfDetailDemo', () => {
  it('mounts its diagram on a canvas', () => {
    const { container } = render(<LevelOfDetailDemo />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('draws every card inside its own container', () => {
    render(<LevelOfDetailDemo />);
    const scene = held.scene!;
    const children = [...scene.nodes.values()].filter((n) => n.parent != null);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const box = worldPoseOf(scene, child.parent!) as Rect;
      const at = worldPoseOf(scene, child.id) as Rect;
      expect(at.x, child.id).toBeGreaterThanOrEqual(box.x);
      expect(at.y, child.id).toBeGreaterThanOrEqual(box.y);
      expect(at.x + at.width, child.id).toBeLessThanOrEqual(box.x + box.width);
      expect(at.y + at.height, child.id).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it('zooms out on a plain scroll, as its hint says', () => {
    held.views = [];
    const { container } = render(<LevelOfDetailDemo />);
    fireEvent.wheel(container.querySelector('canvas')!, { deltaY: 100, clientX: 100, clientY: 100 });
    const last = held.views.at(-1);
    expect(last?.scale.x).toBeLessThan(0.9);
  });
});
