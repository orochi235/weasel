import { act, fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { asNodeId, translatePath, type Path, type Scene } from '@weasel-js/core';

const scenes = vi.hoisted(() => [] as Scene<unknown, string, Path>[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts) as unknown as Scene<unknown, string, Path>;
      if (!scenes.includes(scene)) scenes.push(scene);
      return scene;
    },
  };
});

const { CompoundPathsDemo } = await import('../CompoundPathsDemo');

describe('CompoundPathsDemo', () => {
  it('mounts without throwing and renders a canvas', () => {
    // Smoke-only: catches JSX-parse-error / import-time crash regressions.
    // The demo is otherwise exercised manually; this test just guards the
    // module's render path so a future bad edit fails loudly here.
    const { container } = render(<CompoundPathsDemo />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.isConnected).toBe(true);
  });
});

describe('the compound paths honk', () => {
  it('stays up its full time after a second honk', () => {
    vi.useFakeTimers();
    try {
      const { queryByText, getByRole } = render(<CompoundPathsDemo />);
      const toast = () => queryByText('HONK', { selector: 'div' });
      const honk = getByRole('button', { name: 'honk' });
      act(() => { fireEvent.click(honk); });
      act(() => { vi.advanceTimersByTime(600); });
      act(() => { fireEvent.click(honk); });
      act(() => { vi.advanceTimersByTime(600); });
      expect(toast()).not.toBeNull();
      act(() => { vi.advanceTimersByTime(400); });
      expect(toast()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the honk button', () => {
  it('follows the goose through a drag, before the drag commits', () => {
    scenes.length = 0;
    const { getByRole } = render(<CompoundPathsDemo />);
    const scene = scenes.at(-1)!;
    const honk = getByRole('button', { name: 'honk' });
    const left = parseFloat(honk.style.left);
    const goose = scene.get(asNodeId('goose'))!;
    act(() => {
      scene.overrides.set(goose.id, { pose: translatePath(goose.pose, 50, 0) });
      scene.overrides.commit();
    });
    expect(parseFloat(honk.style.left)).toBeCloseTo(left + 50);
  });
});
