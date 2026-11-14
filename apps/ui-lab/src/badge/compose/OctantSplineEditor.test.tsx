import { act, cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OctantSplineEditor } from './OctantSplineEditor';
import type { SplineAnchor } from './splineAnchors';
import { polarPoint } from './splineGeometry';

// jsdom lays nothing out, so the editor's view box is the client space: an identity screen matrix.
const realCTM = SVGSVGElement.prototype.getScreenCTM;
beforeAll(() => {
  SVGSVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) as DOMMatrix;
});
afterAll(() => {
  SVGSVGElement.prototype.getScreenCTM = realCTM;
});
afterEach(cleanup);

const ANCHORS: SplineAnchor[] = [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 30, w: 1 }, { s: 1, r: 40, w: 1 }];

function mount(anchors = ANCHORS) {
  const handlers = { onAnchorDraft: vi.fn(), onAnchorChange: vi.fn(), onAnchorDelete: vi.fn(), onAnchorAdd: vi.fn() };
  const { container } = render(<OctantSplineEditor anchors={anchors} mode="octant" evalAtS={() => 30} {...handlers} />);
  return { host: container.querySelector('svg')!.parentElement!, ...handlers };
}

const fire = (el: Element, type: string, init: PointerEventInit) =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, buttons: 1, pointerId: 1, button: 0, ...init }));

describe('the spline curve editor', () => {
  it('drafts an anchor through a drag and commits it once, at the release', () => {
    const { host, onAnchorDraft, onAnchorChange } = mount();
    const at = polarPoint('octant', 0.5, 30);
    act(() => {
      fire(host, 'pointerdown', { clientX: at.x, clientY: at.y });
      fire(host, 'pointermove', { clientX: at.x + 5, clientY: at.y });
      fire(host, 'pointermove', { clientX: at.x + 10, clientY: at.y });
      fire(host, 'pointerup', { clientX: at.x + 10, clientY: at.y, buttons: 0 });
    });
    expect(onAnchorDraft.mock.calls.length).toBeGreaterThan(0);
    expect(onAnchorDraft.mock.calls.every(([idx]) => idx === 1)).toBe(true);
    expect(onAnchorChange).toHaveBeenCalledTimes(1);
    const [idx, settled] = onAnchorChange.mock.calls[0]!;
    expect(idx).toBe(1);
    expect(settled).toEqual(onAnchorDraft.mock.calls.at(-1)![1]);
    expect(settled.r).toBeGreaterThan(30);
  });

  it('takes no press away from the empty editor', () => {
    const { host, onAnchorDraft, onAnchorChange } = mount();
    act(() => {
      fire(host, 'pointerdown', { clientX: -6, clientY: 5 });
      fire(host, 'pointermove', { clientX: 20, clientY: 5 });
      fire(host, 'pointerup', { clientX: 20, clientY: 5, buttons: 0 });
    });
    expect(onAnchorDraft).not.toHaveBeenCalled();
    expect(onAnchorChange).not.toHaveBeenCalled();
  });

  it('removes an interior dot on a right-click, and leaves an end, or a curve at its fewest anchors, as it is', () => {
    const fewest = mount();
    const first = polarPoint('octant', 0.5, 30);
    act(() => {
      fewest.host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: first.x, clientY: first.y, button: 2 }));
    });
    expect(fewest.onAnchorDelete).not.toHaveBeenCalled();
    cleanup();
    const { host, onAnchorDelete } = mount([...ANCHORS.slice(0, 2), { s: 0.75, r: 35, w: 1 }, ANCHORS[2]!]);
    const end = polarPoint('octant', 0, 48);
    const mid = polarPoint('octant', 0.5, 30);
    act(() => {
      host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: end.x, clientY: end.y, button: 2 }));
      host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: mid.x, clientY: mid.y, button: 2 }));
    });
    expect(onAnchorDelete.mock.calls).toEqual([[1]]);
  });

  it('weighs the dot under a scroll', () => {
    const { host, onAnchorChange } = mount();
    const mid = polarPoint('octant', 0.5, 30);
    act(() => {
      host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: mid.x, clientY: mid.y, deltaY: -1 }));
    });
    expect(onAnchorChange).toHaveBeenCalledWith(1, { s: 0.5, r: 30, w: 1.1 });
  });

  it('inserts an anchor where an Alt-click lands', () => {
    const { host, onAnchorAdd } = mount();
    act(() => {
      fire(host, 'pointerdown', { clientX: 30, clientY: -10, altKey: true });
      fire(host, 'pointerup', { clientX: 30, clientY: -10, altKey: true, buttons: 0 });
      host.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30, clientY: -10, altKey: true }));
    });
    expect(onAnchorAdd).toHaveBeenCalledTimes(1);
  });
});
