import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import type { AnyTool } from '@weasel-js/routing';
import { SceneCanvas } from '../../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import { dragPanContribution } from './dragPanContribution';

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

const START: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Mount a view-only canvas, drag 30px right and 20px down, and return the
 *  last view it reported. */
function dragOnce(ambient: AnyTool[]): View {
  const scene = createScene<unknown, 'main', { x: number; y: number }>({ systemLayers: [{ id: 'main' }] });
  let last = START;
  const { container } = render(
    <SceneCanvas features={['view']}
      scene={scene}
      layers={{}}
      width={200}
      height={200}
      view={START}
      onViewChange={(v) => { last = v; }}
      ambient={ambient}
    />,
  );
  const canvas = container.querySelector('canvas')!;
  const fire = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
  act(() => {
    fire('pointerdown', 50, 50);
    fire('pointermove', 65, 60);
    fire('pointermove', 80, 70);
    fire('pointerup', 80, 70);
  });
  return last;
}

describe('dragPanContribution', () => {
  it('a plain drag pans nothing on a canvas that did not opt in', () => {
    expect(dragOnce([])).toEqual(START);
  });

  it('pans the view on a plain drag once the canvas opts in', () => {
    const v = dragOnce([dragPanContribution() as AnyTool]);
    expect([v.x, v.y]).toEqual([-30, -20]);
  });

  it("passes its params to the pan: axis 'x' leaves y alone", () => {
    const v = dragOnce([dragPanContribution({ axis: 'x' }) as AnyTool]);
    expect([v.x, v.y]).toEqual([-30, 0]);
  });
});
