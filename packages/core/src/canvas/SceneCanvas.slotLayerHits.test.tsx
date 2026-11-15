/**
 * A layer in a `layers` slot takes presses as a registered one does: hit-tested
 * where it implements `hitTest`, under every registered layer, and topmost
 * painted first among the slots.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { RenderLayer } from 'core/layers/render';
import type { SceneCanvasApi } from './canvasExtension';
import type { SurfaceContribution } from './surfaceContribution';
import { composeAffordanceLayer } from '../affordances/composeAffordanceLayer';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const scene = createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });

function claiming(id: string): RenderLayer<unknown> {
  return { id, label: id, space: 'screen', draw: () => [], hitTest: () => ({}) };
}

type Layers = React.ComponentProps<typeof SceneCanvas>['layers'];

function mount(layers: Layers, ambient: SurfaceContribution[] = []) {
  const ref = React.createRef<SceneCanvasApi>();
  render(<SceneCanvas ref={ref} scene={scene} layers={layers} width={100} height={100} ambient={ambient} />);
  return ref;
}

describe('a layers slot', () => {
  it('is hit-tested', () => {
    const ref = mount({ handles: { layer: claiming('handles'), after: 'scene' } });
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('handles');
  });

  it('is hit topmost painted first', () => {
    const ref = mount({
      low: { layer: claiming('low'), after: 'scene' },
      high: { layer: claiming('high'), after: 'low' },
    });
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('high');
  });

  it('is hit under a registered layer, which paints above every slot', () => {
    const ref = mount(
      { handles: { layer: claiming('slot'), after: 'scene' } },
      [{ id: 'reg', eligibility: { always: true }, layers: [claiming('registered')] }],
    );
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('registered');
  });

  it('is the only stack hit-tested: an entry\'s overlay still only paints', () => {
    const ref = mount({}, [{ id: 'ov', eligibility: { always: true }, overlay: claiming('overlay') }]);
    expect(ref.current?.hitTestExtras(0, 0)).toBeNull();
  });

  it('takes a composed affordance layer as it is', () => {
    const layer = composeAffordanceLayer('dots', 'Dots', [{
      id: 'dot',
      regions: () => [{
        id: 'dot', targetId: null, shape: { kind: 'point', x: 10, y: 10, hitRadiusPx: 4 }, bind: () => ({ initialScratch: null }),
      }],
    }]);
    const ref = mount({ dots: { layer, after: 'scene' } });
    expect(ref.current?.hitTestExtras(10, 10)?.layerId).toBe('dots');
    expect(ref.current?.hitTestExtras(60, 60)).toBeNull();
  });
});
