/** Counterexamples `button.pbt.test.ts` found, kept as plain cases. */
import { describe, expect, it, vi } from 'vitest';
import { createButton } from './button';

const key = { type: 'keydown' as const, key: 'Enter', code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null as never };

describe('createButton, shrunk', () => {
  it('reports a press to every listener when one throws, and the press still lands', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Go' });
    const after = vi.fn();
    b.on('press', () => { throw new Error('listener'); });
    b.on('press', after);
    expect(b.onKey!(key)).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('marks its frame stale on a release when a press listener throws', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Go' });
    b.on('press', () => { throw new Error('listener'); });
    b.onPointer({ type: 'down', x: 5, y: 5, native: null });
    const deps = b.deps!({} as never);
    b.onPointer({ type: 'up', x: 5, y: 5, native: null });
    expect(b.deps!({} as never)).not.toBe(deps);
    errors.mockRestore();
  });

  it('reports once to a listener that takes itself off and puts itself back while it is heard', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Go' });
    let heard = 0;
    const h = () => { heard++; if (heard > 10) return; b.off('press', h); b.on('press', h); };
    b.on('press', h);
    b.onKey!(key);
    expect(heard).toBe(1);
  });

  it('does not report to a listener added while a report is under way', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Go' });
    const late = vi.fn();
    b.on('press', () => { b.on('press', late); });
    b.onKey!(key);
    expect(late).not.toHaveBeenCalled();
    b.onKey!(key);
    expect(late).toHaveBeenCalledTimes(1);
  });
});
