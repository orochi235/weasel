// apps/site/demos/__tests__/SceneScrollerDemo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SceneScrollerDemo } from '../SceneScrollerDemo';
import { WORLD } from '../platformer/worldLevel';
import { tileNodes } from '../platformer/sceneWorld';

describe('SceneScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneScrollerDemo />);
    expect(screen.getByRole('button', { name: /click to start/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('builds the level out of scene nodes rather than draw commands', () => {
    // The point of the demo: the world is in the tree, not in a layer closure.
    expect(tileNodes(WORLD).length).toBeGreaterThan(100);
  });

  it('runs frames without throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneScrollerDemo />);
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('starts the run when the canvas takes focus, but not the toolbar', () => {
    const { container } = render(<SceneScrollerDemo />);
    const toggle = () => screen.getByRole('button', { name: /^click to (start|pause)$/i });
    expect(toggle().textContent).toBe('click to start');

    fireEvent.focus(toggle());
    expect(toggle().textContent).toBe('click to start');

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    fireEvent.focus(canvas!);
    expect(toggle().textContent).toBe('click to pause');
  });
});
