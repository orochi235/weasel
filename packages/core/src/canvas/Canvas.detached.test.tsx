/**
 * `<Canvas>` under `paintInto` / `inputElement`: the ref handle, the HUDs and
 * the input plumbing when the element painted into is not the element input
 * comes from.
 *
 * jsdom cannot paint, so nothing here asserts pixels — the real-GL guards for
 * that live in `tests/visual/tiled-surface.spec.ts`. What jsdom *can* see is
 * which element each role resolved to, which is the whole subject of this arc.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas> ref handle: element vs surface', () => {
  it('attached, element and surface are both the canvas it rendered', async () => {
    const ref = createRef<CanvasExtensionApi>();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<Canvas ref={ref} width={200} height={200} layers={{}} />));
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(ref.current?.element).toBe(canvas);
    expect(ref.current?.surface).toBe(canvas);
  });

  it('detached, element is the input box and surface is the canvas painted into', async () => {
    const ref = createRef<CanvasExtensionApi>();
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    await act(async () => {
      render(
        <Canvas
          ref={ref}
          width={200}
          height={200}
          layers={{}}
          paintInto={{ canvas: shared, x: 40, y: 10 }}
          inputElement={input}
        />,
      );
    });

    expect(ref.current?.element).toBe(input);
    expect(ref.current?.surface).toBe(shared);

    shared.remove();
    input.remove();
  });
});
