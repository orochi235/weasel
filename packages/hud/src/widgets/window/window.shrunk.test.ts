/** Counterexamples `window.pbt.test.ts` found, kept as plain cases. */
import { describe, expect, it, vi } from 'vitest';
import { createWindow } from './window';

describe('createWindow, shrunk', () => {
  it('reports nothing on a cancel of a drag that came back where it began', () => {
    const onResize = vi.fn();
    const onChange = vi.fn();
    const win = createWindow({ id: 'w', x: 0, y: 0, w: 1, h: 1, title: 'W', titlebar: false, onResize, onChange });
    win.onPointer({ type: 'down', x: 0, y: 0, native: null });
    win.onPointer({ type: 'move', x: 0, y: -1, native: null });
    win.onPointer({ type: 'move', x: 0, y: 0, native: null });
    expect(onResize).toHaveBeenCalledTimes(2);
    const changes = onChange.mock.calls.length;
    win.onPointer({ type: 'cancel', native: null });
    expect(onResize).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(changes);
    expect(win.bounds).toEqual({ x: 0, y: 0, w: 80, h: 52 });
  });
});
