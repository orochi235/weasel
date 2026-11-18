/**
 * A second view boxes a plane node where *its* camera's plane draws it, not
 * where the surface's does.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from '@weasel-js/core';
import { CanvasView } from '@weasel-js/core';
import { createScene } from '@weasel-js/core/engine';
import type { RenderLayer } from '@weasel-js/core';
import { useOptionalViewRegistryForTests as useOptionalViewRegistry, type ViewRegistryForTests as ViewRegistry } from '@weasel-js/core/test-seams';
import type { NodeId } from '@weasel-js/core';
import type { Bounds } from '@weasel-js/core';
import { drawPreset } from '@weasel-js/editing';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

describe('<CanvasView> chrome on a parallax layer', () => {
  it('boxes a plane node through the view\'s own camera', () => {
    // The plane does not zoom. At the surface's 1x it agrees with the camera;
    // at the view's 2x its world is the camera's doubled, so the node reads
    // half as large in that view's camera world.
    const scene = createScene<unknown, 'sky', P>({ systemLayers: [{ id: 'sky', parallax: { pan: 1, zoom: 0 } }] });
    scene.add({ id: 'sun' as NodeId, kind: 'mark', layer: 'sky', pose: { x: 40, y: 40, width: 20, height: 20 }, data: {} });
    let seen: Record<string, unknown> | undefined;
    const probe: RenderLayer<unknown> = {
      id: 'probe', label: 'probe',
      draw: (data) => { seen = data as Record<string, unknown>; return []; },
    };
    let registry!: ViewRegistry;
    function Peek() {
      const r = useOptionalViewRegistry()!;
      useEffect(() => { registry = r; }, [r]);
      return null;
    }
    render(
      <SceneCanvas features={[drawPreset]} scene={scene} layers={{ probe: { layer: probe } }} width={300} height={200}>
        <CanvasView id="panel" bounds={{ x: 100, y: 0, width: 100, height: 100 }} view={{ x: 0, y: 0, scale: { x: 2, y: 2 } }} />
        <Peek />
      </SceneCanvas>,
    );
    act(() => { scene.setSelection(['sun' as NodeId]); });
    const outer = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    registry.list()[0]!.layer.draw({}, outer, { width: 300, height: 200, dpr: 1 });
    const chrome = (seen as { getChromeState(): { boundsOf(id: string): Bounds | null } }).getChromeState();
    expect(chrome.boundsOf('sun')).toMatchObject({ x: 20, y: 20, width: 10, height: 10 });
  });
});
