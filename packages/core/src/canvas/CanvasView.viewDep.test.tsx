/**
 * A view's `view` dep carries what the canvas's does: camera animation, coasting, and the content to fit.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

describe('CanvasView view dep', () => {
  it('animates, coasts, and knows the content bounds', () => {
    let registry!: ViewRegistry;
    function Probe() {
      const r = useOptionalViewRegistry();
      useEffect(() => { registry = r!; });
      return null;
    }
    const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: asNodeId('n'), layer: 'main', data: { kind: 'rect' }, pose: { x: 10, y: 20, width: 30, height: 40 } } as never);
    render(
      <SceneCanvas scene={scene} layers={{}} width={400} height={300}>
        <Probe />
        <CanvasView id="pip" bounds={{ x: 250, y: 180, width: 140, height: 105 }} />
      </SceneCanvas>,
    );
    const view = registry.get('pip')!.target.deps!().view!;
    expect(typeof view.animate).toBe('function');
    expect(typeof view.decay).toBe('function');
    expect(view.contentBounds?.()).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
  });
});
