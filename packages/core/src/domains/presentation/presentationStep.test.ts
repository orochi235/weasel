import { describe, expect, it, vi } from 'vitest';
import { layoutPages } from 'core/pages/pages';
import { fitViewToPage } from 'core/pages/fitViewToPage';
import type { View } from 'core/viewport/view';
import { canvasCamera, requestedPage, stepPresentation, type PresentationCamera } from './presentationStep';

const PAGES = layoutPages([
  { id: 'a', width: 400, height: 300 },
  { id: 'b', width: 400, height: 300 },
  { id: 'c', width: 400, height: 300 },
]);
const DIMS = { width: 800, height: 600 };
const HOME: View = { x: 0, y: 0, scale: 1 };

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

describe('canvasCamera', () => {
  it('drives a canvas handle, reading its glide target while it animates', () => {
    let view = fitted(0);
    let animating = false;
    const canvas = {
      getView: () => view,
      getSurfaceRect: () => DIMS,
      setView: vi.fn((v: View) => { view = v; }),
      animateView: vi.fn(() => { animating = true; }),
      isViewAnimating: () => animating,
    };
    const cam = canvasCamera(canvas);
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('b');
    expect(canvas.animateView).toHaveBeenCalledWith(fitted(1), {});
    // The view has not moved yet; the second press steps on from where the first is heading.
    expect(stepPresentation(cam, PAGES, { by: 1 })?.id).toBe('c');
    animating = false;
    expect(stepPresentation(cam, PAGES, { to: 0 }, { animate: false })?.id).toBe('a');
    expect(canvas.setView).toHaveBeenCalledWith(fitted(0));
  });
});
