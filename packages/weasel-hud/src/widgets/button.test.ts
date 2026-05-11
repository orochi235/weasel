import { describe, it, expect, vi } from 'vitest';
import { createButton } from './button';

const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D' };

describe('button widget', () => {
  it('draws a body rect and a label', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Save' });
    const cmds = b.draw(ctx);
    expect(cmds.length).toBeGreaterThanOrEqual(2);   // body + text
    expect(cmds.some(c => c.kind === 'path')).toBe(true);
    expect(cmds.some(c => c.kind === 'text')).toBe(true);
  });

  it('hitTest is bounds-rectangular', () => {
    const b = createButton({ id: 'b', x: 10, y: 10, w: 80, h: 24, label: 'x' });
    expect(b.hitTest(20, 20)).toBe(true);
    expect(b.hitTest(0, 0)).toBe(false);
  });

  it('press event fires on down then up inside bounds', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    expect(b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent })).toBe('claim');
    expect(b.onPointer({ type: 'up', x: 5, y: 5, native: {} as PointerEvent })).toBe('pass');
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('onChange fires when state mutates (used by Hud to trigger redraws)', () => {
    const onChange = vi.fn();
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', onChange });
    onChange.mockClear();
    b.setLabel('y');
    expect(onChange).toHaveBeenCalled();
  });

  it('press event does NOT fire on down then up-outside', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'up', x: 200, y: 200, native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });

  it('cancel rolls back press state without firing press', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'cancel', native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });

  it('setLabel mutates the rendered text', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'a' });
    b.setLabel('b');
    const cmds = b.draw(ctx);
    const txt = cmds.find(c => c.kind === 'text') as { text: string };
    expect(txt.text).toBe('b');
  });

  it('off() removes a handler', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);
    b.off('press', press);
    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'up', x: 5, y: 5, native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });
});
