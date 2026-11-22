import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@weasel-js/core';
import { LayoutDemo } from '../LayoutDemo';

type Rect = { x: number; y: number; width: number; height: number };

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, Rect> | null }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    loadScene: (...args: never[]) => {
      const scene = (core.loadScene as (...a: never[]) => Scene<unknown, string, Rect>)(...args);
      held.scene = scene;
      return scene;
    },
  };
});

afterEach(cleanup);

describe('LayoutDemo', () => {
  it('adds a tile inside the grid container, so the reflow glides it from within', () => {
    render(<LayoutDemo />);
    const scene = held.scene!;
    const add = vi.spyOn(scene, 'add');
    fireEvent.click(screen.getByRole('button', { name: 'add tile' }));
    const container = scene.get('G' as never)!.pose;
    const pose = (add.mock.calls[0]![0] as { pose: Rect }).pose;
    expect(pose.x).toBeGreaterThanOrEqual(0);
    expect(pose.y).toBeGreaterThanOrEqual(0);
    expect(pose.x + pose.width).toBeLessThanOrEqual(container.width);
    expect(pose.y + pose.height).toBeLessThanOrEqual(container.height);
  });
});
