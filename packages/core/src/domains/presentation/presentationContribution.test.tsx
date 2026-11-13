/** `createPresentationContribution` on a canvas: the keys fit the view to each page in turn. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { createPageRun, placedPagesOf } from 'core/pages/pageNodes';
import { fitViewToPage } from 'core/pages/fitViewToPage';
import type { RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { createPresentationContribution, type PresentationOptions } from './presentationContribution';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto['getContext'] = vi.fn(() => null);
  proto['setPointerCapture'] = vi.fn();
  proto['releasePointerCapture'] = vi.fn();
  // jsdom lays nothing out; the `view` dep measures the canvas element.
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => DIMS.width });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => DIMS.height });
});

afterAll(() => {
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)['clientHeight'];
});

const START: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 300 };

function mount(opts: PresentationOptions = {}, paged = true) {
  const scene = createScene<object, 'paper', RectPose>({ systemLayers: [{ id: 'paper' }] });
  if (paged) {
    createPageRun(scene, [
      { id: 'one', width: 200, height: 150 }, { id: 'two', width: 200, height: 150 }, { id: 'three', width: 200, height: 150 },
    ], { gap: 20 });
  }
  const pages = placedPagesOf(scene);
  let view = START;
  const arrived: string[] = [];
  const ambient = [createPresentationContribution({ animate: false, onPage: (p) => arrived.push(p.id), ...opts })];
  render(
    <SceneCanvas scene={scene} layers={{}} width={DIMS.width} height={DIMS.height}
      defaultView={START} onViewChange={(v) => { view = v; }} ambient={ambient} />,
  );
  const press = (key: string) => {
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key })); });
  };
  const fitOf = (i: number) => fitViewToPage(pages[i]!, DIMS, START);
  return { press, view: () => view, fitOf, arrived };
}

describe('createPresentationContribution', () => {
  it('steps on and back through the pages with the arrow keys, and to either end with Home and End', () => {
    const s = mount();
    // The first view shows page one most, so a step on goes to page two.
    s.press('ArrowRight');
    expect(s.view()).toEqual(s.fitOf(1));
    s.press('End');
    expect(s.view()).toEqual(s.fitOf(2));
    s.press('ArrowRight');
    expect(s.view()).toEqual(s.fitOf(2));
    s.press('ArrowUp');
    expect(s.view()).toEqual(s.fitOf(1));
    s.press('Home');
    expect(s.view()).toEqual(s.fitOf(0));
    s.press('PageDown');
    expect(s.view()).toEqual(s.fitOf(1));
    s.press('ArrowLeft');
    expect(s.view()).toEqual(s.fitOf(0));
    expect(s.arrived).toEqual(['two', 'three', 'two', 'one', 'two', 'one']);
  });

  it('wraps past the last page when asked', () => {
    const s = mount({ wrap: true });
    s.press('End');
    s.press('PageDown');
    expect(s.view()).toEqual(s.fitOf(0));
  });

  it('binds no keys with keys off, and nothing moves on a canvas with no pages', () => {
    const off = mount({ keys: false });
    off.press('ArrowRight');
    expect(off.view()).toEqual(START);
    const bare = mount({}, false);
    bare.press('ArrowRight');
    expect(bare.view()).toEqual(START);
    expect(bare.arrived).toEqual([]);
  });
});
