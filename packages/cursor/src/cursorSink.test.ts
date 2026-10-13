import { describe, expect, it } from 'vitest';
import { createCursorSink } from './cursorSink';
import { createPaintedCursorState } from './paintedCursorState';

const ring = { kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 12 } as const;

function harness(initial = '') {
  const el = { style: { cursor: initial } };
  const painted = createPaintedCursorState();
  painted.setPointer(5, 5);
  const sink = createCursorSink({ element: () => el, painted: () => painted });
  return { el, painted, sink };
}

describe('createCursorSink', () => {
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

  it('with no base set, removes only an override it wrote', () => {
    const { el, sink } = harness('help');
    sink.setOverride(null);
    expect(el.style.cursor).toBe('help');
    sink.setOverride({ kind: 'css', css: 'grab' });
    sink.setOverride(null);
    expect(el.style.cursor).toBe('');
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
});
