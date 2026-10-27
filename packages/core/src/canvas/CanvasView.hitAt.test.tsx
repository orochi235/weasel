/**
 * A view's `hitAt` dep answers from that view's own classifier (its camera,
 * its picker), so a right-click in a secondary view gates and opens on what
 * that view sees rather than on the root's classification.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { CanvasView } from './CanvasView';
import { ViewInputsProvider } from './viewInputs';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { View } from 'core/viewport/view';

const PANEL = { x: 100, y: 0, w: 100, h: 100 };
const PANEL_VIEW: View = { x: 0, y: 0, scale: { x: 8, y: 8 } };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

describe('CanvasView hitAt dep', () => {
  it('classifies through the view’s own camera and its own kind lookup', () => {
    let registry!: ViewRegistry;
    function Probe() {
      const r = useOptionalViewRegistry();
      useEffect(() => { registry = r!; });
      return null;
    }
    const inputs = {
      adapter: undefined,
      geometry: AUTO_POSE_DESCRIPTOR as never,
      boundsOf: undefined,
      selectionApi: { current: [], get: () => [], set: () => {} } as never,
      // Only a camera zoomed in 8x reaches the node.
      pickBest: (_world: unknown, view?: { scale: { x: number } } | null) => (view?.scale.x === 8 ? 'n' : null),
      kindOfNode: (id: string) => (id === 'n' ? 'rect' : undefined),
    };
    render(
      <ViewRegistryProvider>
        <ViewInputsProvider value={inputs as never}>
          <Probe />
          <CanvasView id="panel" bounds={PANEL} defaultView={PANEL_VIEW} />
        </ViewInputsProvider>
      </ViewRegistryProvider>,
    );

    const hitAt = registry.list()[0]!.target.deps!().hitAt!;
    expect(hitAt({ x: 150, y: 10 })).toEqual({ bodyTarget: 'unselected-body', bodyKind: 'rect', id: 'n' });
  });
});
