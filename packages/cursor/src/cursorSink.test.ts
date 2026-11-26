import { describe, expect, it } from 'vitest';
import { createCursorSink } from './cursorSink';
import { brushRing } from './brushRing';
import { createPaintedCursorState } from './paintedCursorState';
import { resolveCursor } from './resolve';

const ring = { kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 12 } as const;

function harness(initial = '') {
  const el = { style: { cursor: initial } };
  const painted = createPaintedCursorState();
  painted.setPointer(5, 5);
  const sink = createCursorSink({ element: () => el, painted: () => painted });
  return { el, painted, sink };
}

describe('createCursorSink', () => {
  it('gives the element and the painted base back on release, after any override clears', () => {
    const { el, painted, sink } = harness('help');
    sink.setBase(ring);
    expect(el.style.cursor).toBe('none');
    expect(painted.active()).toBe(true);
    sink.setOverride({ kind: 'css', css: 'grab' });
    sink.release!();
    expect(el.style.cursor).toBe('grab');
    sink.setOverride(null);
    expect(el.style.cursor).toBe('help');
    expect(painted.active()).toBe(false);
  });

  it("shows a painted cursor's fallback where no painted layer draws it", () => {
    const el = { style: { cursor: '' } };
    const sink = createCursorSink({ element: () => el, painted: () => undefined });
    sink.setBase(resolveCursor(brushRing(5, 'world')));
    expect(el.style.cursor).toBe('crosshair');
    sink.setOverride({ kind: 'painted', glyph: 'rotate', angle: 0, size: 200 });
    expect(el.style.cursor).toBe('default');
    const { el: drawn, sink: layered } = harness();
    layered.setBase(resolveCursor(brushRing(5, 'world')));
    expect(drawn.style.cursor).toBe('none');
  });

  it('puts the base back when the override clears', () => {
    const { el, sink } = harness();
    sink.setBase({ kind: 'css', css: 'crosshair' });
    expect(el.style.cursor).toBe('crosshair');
    sink.setOverride({ kind: 'css', css: 'nwse-resize' });
    expect(el.style.cursor).toBe('nwse-resize');
    sink.setOverride(null);
    expect(el.style.cursor).toBe('crosshair');
  });

  it('keeps an override through a base change, then shows the new base', () => {
    const { el, sink } = harness();
    sink.setBase({ kind: 'css', css: 'crosshair' });
    sink.setOverride({ kind: 'css', css: 'grab' });
    sink.setBase({ kind: 'css', css: 'wait' });
    expect(el.style.cursor).toBe('grab');
    sink.setOverride(null);
    expect(el.style.cursor).toBe('wait');
  });

  it('shows the rest value when the base is null', () => {
    const { el, sink } = harness();
    sink.setBase(null, 'pointer');
    sink.setOverride({ kind: 'css', css: 'grab' });
    sink.setOverride(null);
    expect(el.style.cursor).toBe('pointer');
  });

  it('with no base set, removes only an override it wrote, putting back the cursor it replaced', () => {
    const { el, sink } = harness('help');
    sink.setOverride(null);
    expect(el.style.cursor).toBe('help');
    sink.setOverride({ kind: 'css', css: 'grab' });
    sink.setOverride({ kind: 'css', css: 'move' });
    sink.setOverride(null);
    expect(el.style.cursor).toBe('help');
  });

  it('with no base set, leaves a cursor other code wrote over its override', () => {
    const { el, sink } = harness('help');
    sink.setOverride({ kind: 'css', css: 'grab' });
    el.style.cursor = 'wait';
    sink.setOverride(null);
    expect(el.style.cursor).toBe('wait');
  });

  it('hides the native cursor and paints a painted one', () => {
    const { el, painted, sink } = harness();
    sink.setBase(ring);
    expect(el.style.cursor).toBe('none');
    expect(painted.current()?.cursor).toEqual(ring);
  });

  it('a CSS override silences a painted base, which returns when it clears', () => {
    const { el, painted, sink } = harness();
    sink.setBase(ring);
    sink.setOverride({ kind: 'css', css: 'grab' });
    expect(el.style.cursor).toBe('grab');
    expect(painted.current()).toBeNull();
    sink.setOverride(null);
    expect(el.style.cursor).toBe('none');
    expect(painted.current()?.cursor).toEqual(ring);
  });

  it('reads an empty CSS cursor as no cursor', () => {
    const { el, sink } = harness();
    sink.setBase({ kind: 'css', css: 'crosshair' });
    sink.setOverride({ kind: 'css', css: '' });
    expect(el.style.cursor).toBe('crosshair');
  });

  it('gives the element an override was on back its cursor when the target element changes', () => {
    const a = { style: { cursor: 'help' } };
    const b = { style: { cursor: '' } };
    let el = a;
    const sink = createCursorSink({ element: () => el, painted: () => undefined });
    sink.setOverride({ kind: 'css', css: 'grab' });
    el = b;
    sink.setOverride(null);
    expect(a.style.cursor).toBe('help');
    expect(b.style.cursor).toBe('');
  });

  it('with no base set, a replaced override puts back a cursor other code wrote under it', () => {
    const { el, sink } = harness('help');
    sink.setOverride({ kind: 'css', css: 'grab' });
    el.style.cursor = 'wait';
    sink.setOverride({ kind: 'css', css: 'move' });
    sink.setOverride(null);
    expect(el.style.cursor).toBe('wait');
  });

  it('with a base, gives the old element back what it showed before the sink wrote there', () => {
    const a = { style: { cursor: 'help' } };
    const b = { style: { cursor: '' } };
    let el = a;
    const sink = createCursorSink({ element: () => el, painted: () => undefined });
    sink.setBase({ kind: 'css', css: 'crosshair' });
    el = b;
    sink.setBase({ kind: 'css', css: 'crosshair' });
    expect(a.style.cursor).toBe('help');
    expect(b.style.cursor).toBe('crosshair');
    sink.setOverride({ kind: 'css', css: 'grab' });
    el = a;
    sink.setOverride({ kind: 'css', css: 'move' });
    expect(b.style.cursor).toBe('');
    expect(a.style.cursor).toBe('move');
  });

  it('clears the slots it set on a painted state it stops answering', () => {
    const el = { style: { cursor: '' } };
    const first = createPaintedCursorState();
    const second = createPaintedCursorState();
    first.setPointer(5, 5);
    second.setPointer(5, 5);
    let painted = first;
    const sink = createCursorSink({ element: () => el, painted: () => painted });
    sink.setBase(ring);
    sink.setOverride(ring);
    painted = second;
    sink.setOverride(null);
    expect(first.current()).toBeNull();
    expect(second.current()?.cursor).toEqual(ring);
  });

  it('with no base set, removes an override the element serializes differently from how it was written', () => {
    let value = 'text';
    const el = { style: { get cursor() { return value; }, set cursor(v: string) { value = v.trim().toLowerCase(); } } };
    const sink = createCursorSink({ element: () => el, painted: () => undefined });
    sink.setOverride({ kind: 'css', css: 'Grab ' });
    expect(el.style.cursor).toBe('grab');
    sink.setOverride({ kind: 'css', css: 'Pointer' });
    sink.setOverride(null);
    expect(el.style.cursor).toBe('text');
  });

  it('with no base set, leaves a painted override it never set', () => {
    const { painted, sink } = harness();
    painted.setOverride(ring);
    sink.setOverride(null);
    expect(painted.current()?.cursor).toEqual(ring);
    let to = painted;
    const other = createPaintedCursorState();
    const moving = createCursorSink({ element: () => undefined, painted: () => to });
    moving.setOverride(null);
    to = other;
    moving.setOverride(null);
    expect(painted.current()?.cursor).toEqual(ring);
  });

  it('with no base set, puts back the painted override its own replaced, unless other code wrote one since', () => {
    const big = { kind: 'painted', glyph: 'rotate', angle: 0, size: 200 } as const;
    const { painted, sink } = harness();
    painted.setOverride(ring);
    sink.setOverride(big);
    expect(painted.current()?.cursor).toEqual(big);
    sink.setOverride({ kind: 'css', css: 'grab' });
    expect(painted.current()).toBeNull();
    sink.setOverride(null);
    expect(painted.current()?.cursor).toEqual(ring);
    sink.setOverride(big);
    painted.setOverride('none');
    sink.setOverride(null);
    expect(painted.getOverride()).toBe('none');
  });
});
