import { describe, it, expect, vi } from 'vitest';
import { createRect } from './rect';

describe('rect widget', () => {
  it('emits a path DrawCommand for its bounds', () => {
    const r = createRect({ id: 'r1', x: 10, y: 20, w: 30, h: 40, fill: '#abcdef' });
    const cmds = r.draw({ dims: { width: 100, height: 100 }, defaultFont: 'x' });
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0];
    expect(cmd.kind).toBe('path');
    expect((cmd as { fill?: { color: string } }).fill?.color).toBe('#abcdef');
  });

  it('hitTest is true inside the rect, false outside', () => {
    const r = createRect({ id: 'r1', x: 10, y: 10, w: 20, h: 20, fill: '#000' });
    expect(r.hitTest(15, 15)).toBe(true);
    expect(r.hitTest(0, 0)).toBe(false);
    expect(r.hitTest(30, 30)).toBe(false); // exclusive on far edge
  });

  it('hidden rect never hits', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 50, h: 50, fill: '#000' });
    r.setHidden(true);
    expect(r.hitTest(10, 10)).toBe(false);
  });

  it('setBounds mutates and is reflected in subsequent draws', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#fff' });
    r.setBounds({ x: 5, y: 5, w: 20, h: 20 });
    expect(r.bounds).toEqual({ x: 5, y: 5, w: 20, h: 20 });
  });

  it('onPointer always returns pass (rect is not interactive in v1)', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#fff' });
    expect(r.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent })).toBe('pass');
  });

  it('onChange fires when state mutates', () => {
    const onChange = vi.fn();
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#fff', onChange });
    onChange.mockClear();
    r.setBounds({ x: 1, y: 2, w: 3, h: 4 });
    r.setFill('#000');
    r.setHidden(true);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('throws on zero/negative bounds', () => {
    expect(() => createRect({ id: 'r1', x: 0, y: 0, w: 0, h: 10, fill: '#fff' })).toThrow();
  });

  it('throws on setter after dispose', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#000' });
    r.dispose();
    expect(() => r.setFill('#fff')).toThrow();
    expect(() => r.setBounds({ x: 0, y: 0, w: 5, h: 5 })).toThrow();
    expect(() => r.setHidden(true)).toThrow();
  });

  it('dispose() is idempotent — calling twice does not throw', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#000' });
    r.dispose();
    expect(() => r.dispose()).not.toThrow();
  });

  it('dispose() calls removeFromHud', () => {
    const removeFromHud = vi.fn();
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#000', removeFromHud });
    r.dispose();
    expect(removeFromHud).toHaveBeenCalledTimes(1);
    // second dispose should not call it again
    r.dispose();
    expect(removeFromHud).toHaveBeenCalledTimes(1);
  });
});
