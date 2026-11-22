import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { worldPoseOf, type Scene, type View } from '@weasel-js/core';
import { ParallaxDemo } from '../ParallaxDemo';

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, unknown> | null, view: null as View | null }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts);
      held.scene = scene as never;
      return scene;
    },
    SceneCanvas: (props: { view: View }) => {
      held.view = props.view;
      return createElement(core.SceneCanvas, props as never);
    },
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ParallaxDemo', () => {
  it('keeps a per-plane zoom toggle made while the intro plays', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queued.set(nextId, cb); return nextId++; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    let now = 0;
    const step = (ms: number): void => {
      now += ms;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };
    const trees = () => held.scene!.layers.find((l) => l.id === 'trees')!.parallax!;

    render(<ParallaxDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'play intro' }));
    step(16);
    step(200);
    const mid = trees().anchor!.x;
    expect(mid).toBeLessThan(0);
    act(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'per-plane zoom' })); });
    // The toggle leaves the intro where it was rather than jumping it to its end.
    expect(trees()).toMatchObject({ zoom: 1.5, anchor: { x: mid } });
    step(200);
    expect(trees().zoom).toBe(1.5);
    for (let i = 0; i < 10; i++) step(200);
    expect(trees()).toMatchObject({ zoom: 1.5, anchor: { x: 0 } });
  });

  it('draws every tree part inside its tree, on the stage', () => {
    render(<ParallaxDemo />);
    const scene = held.scene!;
    type Rect = { x: number; y: number; width: number; height: number };
    const parts = [...scene.nodes.values()].filter((n) => n.layer === 'trees' && n.parent != null);
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      const tree = worldPoseOf(scene, part.parent!) as Rect;
      const at = worldPoseOf(scene, part.id) as Rect;
      expect(at.x, part.id).toBeGreaterThanOrEqual(tree.x);
      expect(at.y, part.id).toBeGreaterThanOrEqual(tree.y);
      expect(at.x + at.width, part.id).toBeLessThanOrEqual(tree.x + tree.width);
      expect(at.y + at.height, part.id).toBeLessThanOrEqual(tree.y + tree.height);
    }
  });

  it('keeps the ground on the stage when the zoom control zooms in', () => {
    render(<ParallaxDemo />);
    const field = screen.getByRole('textbox', { name: 'Zoom' });
    fireEvent.change(field, { target: { value: '300%' } });
    fireEvent.blur(field);
    const view = held.view!;
    expect(view.scale).toEqual({ x: 3, y: 3 });
    // The ground band spans world y 320–400 on a 400px stage, and panning is horizontal only.
    const screenY = (y: number) => (y - view.y) * view.scale.y;
    expect(screenY(320)).toBeLessThan(400);
    expect(screenY(400)).toBeCloseTo(400);
  });
});
