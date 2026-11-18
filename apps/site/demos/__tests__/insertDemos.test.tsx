import { act, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@weasel-js/core';

const scenes = vi.hoisted(() => [] as Scene<unknown, string, unknown>[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts) as unknown as Scene<unknown, string, unknown>;
      if (!scenes.includes(scene)) scenes.push(scene);
      return scene;
    },
  };
});

const { InsertDemo } = await import('../InsertDemo');
const { ImageDemo } = await import('../ImageDemo');

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function drag(canvas: Element, from: [number, number], to: [number, number]): void {
  const opts = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, isPrimary: true });
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(...from)));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts(...to)));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(...to)));
  });
}

describe('the insert demos', () => {
  it('InsertDemo makes a rect from a drag under its rect tool', () => {
    scenes.length = 0;
    const { container } = render(<InsertDemo />);
    const scene = scenes.at(-1)!;
    const before = scene.nodesOnLayer('default').length;
    drag(container.querySelector('canvas')!, [20, 20], [120, 100]);
    expect(scene.nodesOnLayer('default').length).toBe(before + 1);
  });

  it('ImageDemo drops an image from a drag on empty space under its image tool', () => {
    scenes.length = 0;
    const { container, getByRole } = render(<ImageDemo />);
    const scene = scenes.at(-1)!;
    const before = scene.nodesOnLayer('default').length;
    act(() => { getByRole('button', { name: /image/i }).click(); });
    drag(container.querySelector('canvas')!, [520, 20], [580, 60]);
    expect(scene.nodesOnLayer('default').length).toBe(before + 1);
  });
});
