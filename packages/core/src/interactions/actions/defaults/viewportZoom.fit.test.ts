import { describe, it, expect } from 'vitest';
import { matchSpec, type InputEvent } from '@weasel-js/gestures';
import { viewportZoomAction } from './viewportZoom';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { HOME_VIEW } from 'core/viewport/homeView';

const HOST = { width: 400, height: 200 };

function fitView(content: Bounds | null, from: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }, recenter?: () => View | void): View {
  let v = from;
  const view: ViewApi = {
    get: () => v, set: (next) => { v = next; }, hostSize: () => HOST, contentBounds: () => content,
    ...(recenter ? { recenter } : {}),
  };
  const invoker = viewportZoomAction.invoker;
  if (invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  invoker.run({ view }, { kind: 'fit' });
  return v;
}

/** The world rect `v` shows over {@link HOST}. */
const shown = (v: View) => ({ x: v.x, y: v.y, width: HOST.width / v.scale.x, height: HOST.height / v.scale.y });

describe("viewport.zoom's fit", () => {
  it('shows all of the content, centered, at the zoom that fills one axis', () => {
    const content = { x: 100, y: 50, width: 200, height: 50 };
    const v = fitView(content);
    const s = shown(v);
    expect(s.x).toBeLessThanOrEqual(content.x);
    expect(s.y).toBeLessThanOrEqual(content.y);
    expect(s.x + s.width).toBeGreaterThanOrEqual(content.x + content.width);
    expect(s.y + s.height).toBeGreaterThanOrEqual(content.y + content.height);
    expect(s.x + s.width / 2).toBeCloseTo(200);
    expect(s.y + s.height / 2).toBeCloseTo(75);
    expect(v.scale.x).toBeGreaterThan(1);
  });

  it('fits a lone horizontal line along its length', () => {
    const v = fitView({ x: 0, y: 10, width: 100, height: 0 });
    const s = shown(v);
    expect(s.x).toBeLessThanOrEqual(0);
    expect(s.x + s.width).toBeGreaterThanOrEqual(100);
    expect(s.y + s.height / 2).toBeCloseTo(10);
    expect(Number.isFinite(v.scale.x)).toBe(true);
  });

  it('goes to the view Cmd-0 gives for content with no extent', () => {
    const from = { x: 7, y: 8, scale: { x: 2, y: 2 } };
    expect(fitView({ x: 30, y: 40, width: 0, height: 0 }, from)).toEqual(HOME_VIEW);
    expect(fitView(null, from)).toEqual(HOME_VIEW);
  });

  it("goes to the owner's recenter view for empty content, as Cmd-0 does", () => {
    const home = { x: -50, y: -20, scale: { x: 0.5, y: 0.5 } };
    expect(fitView(null, { x: 7, y: 8, scale: { x: 2, y: 2 } }, () => home)).toBe(home);
  });

  it('is bound to Cmd-Alt-0 by the key the 0 is on, whatever character Alt makes of it', () => {
    const bindings = viewportZoomAction.defaultBinding as Array<{ spec: Parameters<typeof matchSpec>[1]; opts: { params: { kind: string } } }>;
    const press = { kind: 'key', key: 'º', code: 'Digit0', altKey: true, metaKey: true, ctrlKey: false, shiftKey: false } as InputEvent;
    expect(bindings.filter((b) => matchSpec(press, b.spec, true)).map((b) => b.opts.params.kind)).toEqual(['fit']);
  });
});
