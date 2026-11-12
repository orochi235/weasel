import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from '../../../canvas/SceneCanvas';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import { dragPanContribution } from './dragPanContribution';
import type { Contribution } from '../../overlayBinding';

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

interface DragOpts {
  features?: 'view'[];
  /** `PointerEvent.button` of the press. */
  button?: number;
}

/** Mount a canvas, drag 30px right and 20px down, and return the last view it
 *  reported and whether the press was default-prevented. */
function drag(ambient: Contribution[], { features = ['view'], button = 0 }: DragOpts = {}): { view: View; prevented: boolean } {
  const scene = createScene<unknown, 'main', { x: number; y: number }>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  let last = START;
  const { container } = render(
    <SceneCanvas features={features}
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
  const fire = (type: string, x: number, y: number) => {
    const ev = new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
      button: type === 'pointermove' ? -1 : button,
    });
    canvas.dispatchEvent(ev);
    return ev;
  };
  let prevented = false;
  act(() => {
    prevented = fire('pointerdown', 50, 50).defaultPrevented;
    fire('pointermove', 65, 60);
    fire('pointermove', 80, 70);
    fire('pointerup', 80, 70);
  });
  return { view: last, prevented };
}

const dragOnce = (ambient: Contribution[]): View => drag(ambient).view;

describe('dragPanContribution', () => {
  it('a plain drag pans nothing on a canvas that did not opt in', () => {
    expect(dragOnce([])).toEqual(START);
  });

  it('pans the view on a plain drag once the canvas opts in', () => {
    const v = dragOnce([dragPanContribution()]);
    expect([v.x, v.y]).toEqual([-30, -20]);
  });

  it("passes its params to the pan: axis 'x' leaves y alone", () => {
    const v = dragOnce([dragPanContribution({ axis: 'x' })]);
    expect([v.x, v.y]).toEqual([-30, 0]);
  });
});

describe('middle-button drag', () => {
  it('pans under the view preset, which installs it, and takes the press from the browser', () => {
    const { view, prevented } = drag([], { button: 1 });
    expect([view.x, view.y]).toEqual([-30, -20]);
    expect(prevented).toBe(true);
  });

  it('leaves a press nothing binds to the browser, panning nothing', () => {
    const { view, prevented } = drag([], { features: [], button: 1 });
    expect(view).toEqual(START);
    expect(prevented).toBe(false);
  });

  it('does not take a primary drag', () => {
    expect(drag([]).view).toEqual(START);
  });

  it('leaves the right button alone', () => {
    expect(drag([], { button: 2 }).view).toEqual(START);
  });
});
