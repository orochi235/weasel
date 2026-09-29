import { describe, it, expect, vi } from 'vitest';
import type { CanvasExtensionApi, RenderLayer } from '@weasel-js/core';
import { createPaintedCursorState } from '@weasel-js/core';
import { attachHud } from './attach';
import { createHud } from './hud';
import { createText } from './widgets/text';
import type { Widget } from './widget';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 300 };

function attached() {
  let layer: RenderLayer<unknown> | undefined;
  const api: CanvasExtensionApi = {
    element: null,
    surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn((l: RenderLayer<unknown>) => { layer = l; return () => {}; }),
    getView: vi.fn(() => VIEW),
    setView: vi.fn(),
    subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0),
    paintedCursor: createPaintedCursorState(),
    getDebug: () => null,
  };
  const hud = createHud();
  attachHud(api, hud, { font: 'sans-serif' });
  const paint = (dims = DIMS) => layer!.draw(null, VIEW, { ...dims });
  return { hud, paint };
}

function plain(extra: Partial<Widget> = {}): Widget {
  return {
    id: 'plain', bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false,
    draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } }],
    hitTest: () => false, onPointer: () => {}, dispose: () => {},
    ...extra,
  };
}

describe('attachHud: widget command cache', () => {
  it('builds an unchanged text widget once across repaints', () => {
    const { hud, paint } = attached();
    const label = hud.text({ id: 't', x: 10, y: 10, text: 'static label', fontSize: 14 });
    const draw = vi.spyOn(label, 'draw');
    for (let i = 0; i < 10; i++) paint();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  // The renderer's text layout cache is keyed on the runs array's identity,
  // so a rebuilt-but-equal command re-lays out every glyph.
  it('hands the renderer the same command objects while nothing changed', () => {
    const { hud, paint } = attached();
    hud.text({ id: 't', x: 10, y: 10, text: 'static label', fontSize: 14 });
    const a = paint();
    const b = paint();
    expect(b[0]).toBe(a[0]);
  });

  it('rebuilds on the next repaint after a setter, and only then', () => {
    const { hud, paint } = attached();
    const label = hud.text({ id: 't', x: 10, y: 10, text: 'one', fontSize: 14 });
    const draw = vi.spyOn(label, 'draw');
    paint();
    label.setText('two');
    paint(); paint();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(paint()[0]).toMatchObject({ runs: [expect.objectContaining({ text: 'two' })] });
  });

  it('rebuilds when a widget moves', () => {
    const { hud, paint } = attached();
    const label = hud.text({ id: 't', x: 10, y: 10, text: 'one', fontSize: 14 });
    const before = paint()[0];
    label.setBounds({ x: 50, y: 10, w: 0, h: 14 });
    const after = paint()[0];
    expect(after).not.toBe(before);
    expect(after).toMatchObject({ x: 50 });
  });

  // A label pinned to the camera moves every frame; only its position changed,
  // so its runs must keep their identity for the layout cache to hold.
  it('keeps a moved text widget\'s runs array', () => {
    const { hud, paint } = attached();
    const label = hud.text({ id: 't', x: 10, y: 10, text: 'one', fontSize: 14 });
    const before = paint()[0] as { runs: unknown };
    label.setBounds({ x: 50, y: 10, w: 0, h: 14 });
    const after = paint()[0] as { runs: unknown };
    expect(after.runs).toBe(before.runs);
    label.setText('two');
    expect((paint()[0] as { runs: unknown }).runs).not.toBe(before.runs);
  });

  it('invalidates a bare-factory widget that has no onChange', () => {
    const { hud, paint } = attached();
    const label = createText({ id: 't', x: 0, y: 0, text: 'one', fontSize: 14 });
    hud.add(label);
    paint();
    label.setText('two');
    expect(paint()[0]).toMatchObject({ runs: [expect.objectContaining({ text: 'two' })] });
  });

  it('rebuilds when the canvas resizes', () => {
    const { hud, paint } = attached();
    const draw = vi.fn(() => []);
    hud.add(plain({ draw, deps: () => [] }));
    paint(); paint();
    paint({ width: 800, height: 300 });
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('rebuilds when the widget gains or loses focus, or its ring shows', () => {
    const { hud, paint } = attached();
    const draw = vi.fn(() => []);
    const w = plain({ draw, deps: () => [], focusable: true });
    hud.add(w);
    paint();
    hud.focus(w, { visible: false }); paint();
    hud.focus(w, { visible: true }); paint();
    hud.focus(null); paint(); paint();
    expect(draw).toHaveBeenCalledTimes(4);
  });

  it('rebuilds a button whose hover state changed', () => {
    const { hud, paint } = attached();
    const btn = hud.button({ id: 'b', x: 0, y: 0, w: 40, h: 20, label: 'Go' });
    const rest = paint()[0];
    btn.onPointer({ type: 'hovermove', x: 5, y: 5, native: null });
    expect(paint()[0]).not.toBe(rest);
  });

  it('rebuilds a hand-written widget when its declared deps change', () => {
    const { hud, paint } = attached();
    let value = 1;
    const draw = vi.fn(() => []);
    hud.add(plain({ draw, deps: () => [value] }));
    paint(); paint();
    value = 2;
    paint(); paint();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('rebuilds a widget that declares no deps on every repaint', () => {
    const { hud, paint } = attached();
    const draw = vi.fn(() => []);
    hud.add(plain({ draw }));
    for (let i = 0; i < 5; i++) paint();
    expect(draw).toHaveBeenCalledTimes(5);
  });
});
