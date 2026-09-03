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

describe('<Canvas> detached client→world', () => {
  it('measures the input element, not the canvas painted into', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    // The pane sits 400px into the shared surface. If a conversion measured
    // the surface instead of the box, the x it reports would be off by 400.
    shared.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 820, height: 400, right: 820, bottom: 400 }) as DOMRect;
    input.getBoundingClientRect = () =>
      ({ left: 400, top: 0, width: 380, height: 360, right: 780, bottom: 360 }) as DOMRect;

    const seen: HTMLElement[] = [];
    await act(async () => {
      render(
        <Canvas
          width={380}
          height={360}
          layers={{}}
          paintInto={{ canvas: shared, x: 400, y: 0 }}
          inputElement={input}
          clientToWorld={(el, cx, cy) => {
            seen.push(el);
            const r = el.getBoundingClientRect();
            return [cx - r.left, cy - r.top];
          }}
        />,
      );
    });

    await act(async () => {
      input.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 450, clientY: 30, bubbles: true }),
      );
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const el of seen) expect(el).toBe(input);

    shared.remove();
    input.remove();
  });
});

describe('<Canvas> HUDs when detached', () => {
  it('renders the cursor-coords HUD even with no canvas of its own', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          paintInto={{ canvas: shared, x: 0, y: 0 }}
          inputElement={input}
          cursorCoordsHud
        />,
      ));
    });

    // The HUD is the only thing this render can produce: detached, <Canvas>
    // renders no element of its own.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    expect(container.querySelector('canvas')).toBeNull();

    shared.remove();
    input.remove();
  });

  it('anchors a detached HUD to the input box, not to the shared container', async () => {
    const host = document.createElement('div');
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    host.append(shared, input);
    document.body.append(host);

    const measured: Element[] = [];
    for (const [el, rect] of [
      [host, { left: 0, top: 0, width: 820, height: 400 }],
      [input, { left: 400, top: 0, width: 380, height: 360 }],
    ] as const) {
      el.getBoundingClientRect = () => {
        measured.push(el);
        return {
          ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height,
        } as DOMRect;
      };
    }

    await act(async () => {
      render(
        <Canvas
          width={380}
          height={360}
          layers={{}}
          paintInto={{ canvas: shared, x: 400, y: 0 }}
          inputElement={input}
          cursorCoordsHud
        />,
      );
    });

    // The anchor measured the pane, not the strip it sits in. Both panes'
    // HUDs would otherwise resolve to the same corner.
    expect(measured).toContain(input);
    expect(measured).not.toContain(host);

    host.remove();
  });
});
