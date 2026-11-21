import { describe, expect, it, vi } from 'vitest';
import { layoutPages } from 'core/pages/pages';
import { fitViewToPage } from 'core/pages/fitViewToPage';
import type { View } from 'core/viewport/view';
import { createCanvasCamera, requestedPage, stepPresentation, type PresentationCamera } from './presentationStep';

const PAGES = layoutPages([
  { id: 'a', width: 400, height: 300 },
  { id: 'b', width: 400, height: 300 },
  { id: 'c', width: 400, height: 300 },
]);
const DIMS = { width: 800, height: 600 };
const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function camera(start: View = HOME) {
  let view = start;
  const shown: { to: View; animated: boolean }[] = [];
  const cam: PresentationCamera = {
    get: () => view,
    dims: () => DIMS,
    show: (to, animate) => {
      view = to;
      shown.push({ to, animated: animate !== null });
    },
  };
  return { cam, shown };
}

const fitted = (index: number) => fitViewToPage(PAGES[index]!, DIMS, HOME)!;

describe('requestedPage', () => {
  it('steps along the order from the current page, and names pages by id, index and end', () => {
    expect(requestedPage(PAGES, PAGES[0]!, { by: 1 })?.id).toBe('b');
    expect(requestedPage(PAGES, PAGES[2]!, { by: 1 })).toBeNull();
    expect(requestedPage(PAGES, PAGES[2]!, { by: 1 }, true)?.id).toBe('a');
    expect(requestedPage(PAGES, null, { by: -1 })?.id).toBe('c');
    expect(requestedPage(PAGES, null, { to: 'c' })?.id).toBe('c');
    expect(requestedPage(PAGES, null, { to: 1 })?.id).toBe('b');
    expect(requestedPage(PAGES, null, { to: 'last' })?.id).toBe('c');
    expect(requestedPage(PAGES, null, { to: 'first' })?.id).toBe('a');
    expect(requestedPage(PAGES, null, { end: 'last' })?.id).toBe('c');
    expect(requestedPage(PAGES, null, { end: 'first' })?.id).toBe('a');
  });

  it("names a page whose id is 'first' or 'last' by that id, and its end by `end`", () => {
    const pages = PAGES.map((p, i) => ({ ...p, id: ['x', 'last', 'first'][i]! }));
    expect(requestedPage(pages, null, { to: 'first' })?.id).toBe('first');
    expect(requestedPage(pages, null, { to: 'last' })?.id).toBe('last');
    expect(requestedPage(pages, null, { end: 'first' })?.id).toBe('x');
    expect(requestedPage(pages, null, { end: 'last' })?.id).toBe('first');
    expect(requestedPage(PAGES, null, { to: 'z' })).toBeNull();
  });
});

describe('stepPresentation', () => {
  it('fits the next page from the one in view, gliding by default', () => {
    const { cam, shown } = camera(fitted(0));
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('b');
    expect(shown).toEqual([{ to: fitted(1), animated: true }]);
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('c');
  });

  it('cuts when animate is false, and moves nothing past the end', () => {
    const { cam, shown } = camera(fitted(2));
    expect(stepPresentation(cam, PAGES, { by: 1 }, { animate: false })).toBeNull();
    expect(stepPresentation(cam, PAGES, { to: 'first' }, { animate: false })?.id).toBe('a');
    expect(shown).toEqual([{ to: fitted(0), animated: false }]);
  });

  it('steps on from where a glide in flight is heading', () => {
    const { cam } = camera(fitted(0));
    cam.target = () => fitted(1);
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('c');
  });

  it('moves nothing before the viewport can be measured', () => {
    const { cam, shown } = camera();
    cam.dims = () => null;
    expect(stepPresentation(cam, PAGES, { by: 1 })).toBeNull();
    expect(shown).toEqual([]);
  });
});

describe('createCanvasCamera', () => {
  it("drives a canvas handle, stepping on from the canvas's glide target while it animates", () => {
    let view = fitted(0);
    let target: View | null = null;
    const canvas = {
      getView: () => view,
      getSurfaceRect: () => DIMS,
      setView: vi.fn((v: View) => { view = v; }),
      animateView: vi.fn((to: View) => { target = to; }),
      viewAnimationTarget: () => target,
    };
    const cam = createCanvasCamera(canvas);
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('b');
    expect(canvas.animateView).toHaveBeenCalledWith(fitted(1), {});
    // The view has not moved yet; the second press steps on from where the first is heading.
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('c');
    target = null;
    expect(stepPresentation(cam, PAGES, { to: 0 }, { animate: false })?.id).toBe('a');
    expect(canvas.setView).toHaveBeenCalledWith(fitted(0));
  });

  it('steps on from a glide it did not start, even one that cut its own short', () => {
    let target: View | null = null;
    const canvas = {
      getView: () => fitted(0),
      getSurfaceRect: () => DIMS,
      setView: vi.fn(),
      // A glide started over another cancels it without calling its onDone.
      animateView: vi.fn((to: View) => { target = to; }),
      viewAnimationTarget: () => target,
    };
    const cam = createCanvasCamera(canvas);
    stepPresentation(cam, PAGES, { to: 2 });
    canvas.animateView(fitted(0));
    expect(cam.target?.()).toEqual(fitted(0));
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('b');
  });
});
