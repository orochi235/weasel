import { describe, it, expect } from 'vitest';
import { matchSpec, type InputEvent } from '@weasel-js/gestures';
import { viewportZoomAction } from './viewportZoom';
import type { View } from 'core/viewport/view';
import type { ViewApi } from '../depSchema';
import type { Bounds } from 'core/viewport/fitViewToBounds';

const HOST = { width: 400, height: 200 };

function fitView(content: Bounds | null, from: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }): View {
  let v = from;
  const view: ViewApi = { get: () => v, set: (next) => { v = next; }, hostSize: () => HOST, contentBounds: () => content };
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

  it('centers a lone point at the zoom it has', () => {
    const from = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    const v = fitView({ x: 30, y: 40, width: 0, height: 0 }, from);
    expect(v.scale).toEqual(from.scale);
    expect(v.x + HOST.width / 4).toBeCloseTo(30);
    expect(v.y + HOST.height / 4).toBeCloseTo(40);
  });

  it('leaves the view alone with no content', () => {
    const from = { x: 7, y: 8, scale: { x: 1, y: 1 } };
    expect(fitView(null, from)).toBe(from);
  });

  it('is bound to Cmd-Alt-0 by the key the 0 is on, whatever character Alt makes of it', () => {
    const bindings = viewportZoomAction.defaultBinding as Array<{ spec: Parameters<typeof matchSpec>[1]; opts: { params: { kind: string } } }>;
    const press = { kind: 'key', key: 'º', code: 'Digit0', altKey: true, metaKey: true, ctrlKey: false, shiftKey: false } as InputEvent;
    expect(bindings.filter((b) => matchSpec(press, b.spec, true)).map((b) => b.opts.params.kind)).toEqual(['fit']);
  });
});
