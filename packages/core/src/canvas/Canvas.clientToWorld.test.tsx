/**
 * A `<Canvas>` given a `clientToWorld` override answers every client→world
 * question with it: hover, the view registry's occlusion test, and the
 * conversion its handles publish.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import type { RenderLayer } from 'core/layers/render';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const LEFT = 10;
const TOP = 20;

/** A canvas drawn at half size by a CSS transform, as its consumer accounts
 *  for it: two client pixels per world unit, from the element's corner. */
function halfScale(el: HTMLElement, clientX: number, clientY: number): [number, number] {
  const r = el.getBoundingClientRect();
  return [(clientX - r.left) / 2, (clientY - r.top) / 2];
}

function mount() {
  const api = createRef<CanvasExtensionApi>();
  let registry!: ViewRegistry;
  function Grab() {
    registry = useOptionalViewRegistry()!;
    return null;
  }
  const { container } = render(
    <ViewRegistryProvider>
      <Grab />
      <Canvas ref={api} width={200} height={200} layers={{}} clientToWorld={halfScale} />
    </ViewRegistryProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: LEFT, top: TOP, right: LEFT + 200, bottom: TOP + 200, width: 200, height: 200,
    x: LEFT, y: TOP, toJSON: () => ({}),
  });
  return { api: api.current!, surface: registry.surface()!, canvas };
}

describe('<Canvas clientToWorld>', () => {
  it('asks a registered layer about the same world point for hover and for the view registry', () => {
    const { api, surface, canvas } = mount();
    const hovered: [number, number][] = [];
    const tested: [number, number][] = [];
    const layer: RenderLayer<unknown> = {
      id: 'chrome',
      label: 'chrome',
      draw: () => [],
      onUncapturedMove: (wx, wy) => { hovered.push([wx, wy]); },
      hitTest: (wx, wy) => { tested.push([wx, wy]); return null; },
    };
    act(() => { api.registerLayer(layer); });

    const client = { x: LEFT + 40, y: TOP + 60 };
    fireEvent.pointerMove(canvas, { clientX: client.x, clientY: client.y });
    // The registry asks in canvas-local pixels: the client point less the
    // element's corner.
    surface.claimsAbove(client.x - LEFT, client.y - TOP);

    expect(hovered).toEqual([[20, 30]]);
    expect(tested).toEqual([[20, 30]]);
  });

  it('publishes the conversion on the ref handle and on the surface handle', () => {
    const { api, surface } = mount();
    expect(api.clientToWorld!(LEFT + 40, TOP + 60)).toEqual([20, 30]);
    expect(surface.clientToWorld(LEFT + 40, TOP + 60)).toEqual([20, 30]);
  });
});

describe('<Canvas> without a clientToWorld override', () => {
  it('publishes the conversion through the element rect and the view', () => {
    const api = createRef<CanvasExtensionApi>();
    const { container } = render(
      <Canvas
        ref={api} width={200} height={200} layers={{}}
        defaultView={{ x: 5, y: 7, scale: { x: 2, y: 2 } }}
      />,
    );
    container.querySelector('canvas')!.getBoundingClientRect = () => ({
      left: LEFT, top: TOP, right: LEFT + 200, bottom: TOP + 200, width: 200, height: 200,
      x: LEFT, y: TOP, toJSON: () => ({}),
    });
    expect(api.current!.clientToWorld!(LEFT + 40, TOP + 60)).toEqual([25, 37]);
  });
});
