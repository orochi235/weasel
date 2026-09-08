import { describe, it, expect } from 'vitest';
import { computeWheelAction, type WheelInput } from 'core/viewport/wheelHandler';
import type { View } from 'core/viewport/view';
import { viewportZoomAction } from './viewportZoom';
import { viewportWheelPanAction } from './viewportWheelPan';
import type { ViewApi } from '../depSchema';

const base: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const at = (x: number, y: number): Pick<WheelInput, 'x' | 'y'> => ({ x, y });

function makeView(initial: View = base): ViewApi & { value: View } {
  const api = {
    value: initial,
    get() { return api.value; },
    set(next: View) { api.value = next; },
  };
  return api as ViewApi & { value: View };
}

// ---------------------------------------------------------------------------
// The actions and the reducer are one implementation
// ---------------------------------------------------------------------------

describe('the wheel actions agree with the reducer', () => {
  it('viewport.zoom matches computeWheelAction on a modified wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 2 } });
    const invoker = viewportZoomAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { kind: 'wheel', deltaY: -120, clientX: 250, clientY: 130 });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 2 } },
        { deltaX: 0, deltaY: -120, metaKey: true, ...at(250, 130) },
      ),
    );
  });

  it('viewport.wheelPan matches computeWheelAction on a bare wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 4 } });
    const invoker = viewportWheelPanAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { deltaX: 12, deltaY: -30 });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 4 } },
        { deltaX: 12, deltaY: -30, ...at(0, 0) },
      ),
    );
  });

  it('viewport.wheelPan matches computeWheelAction on shift+wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 4 } });
    const invoker = viewportWheelPanAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { deltaX: 0, deltaY: -30, swapAxis: true });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 4 } },
        { deltaX: 0, deltaY: -30, shiftKey: true, ...at(0, 0) },
      ),
    );
  });
});
