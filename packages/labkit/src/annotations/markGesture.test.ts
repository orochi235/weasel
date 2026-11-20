import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMarkGesture } from './markGesture';

afterEach(() => vi.useRealTimers());

describe('mark gesture keys', () => {
  it('keeps one key through a burst to one field of one scope', () => {
    vi.useFakeTimers();
    const g = createMarkGesture('restyle');
    const a = g('width', 'm1');
    vi.advanceTimersByTime(100);
    expect(g('width', 'm1')).toBe(a);
    expect(g('color', 'm1')).not.toBe(a);
  });

  it('hands a new burst a fresh key after a pause', () => {
    vi.useFakeTimers();
    const g = createMarkGesture('restyle');
    const a = g('width', 'm1');
    vi.advanceTimersByTime(1000);
    expect(g('width', 'm1')).not.toBe(a);
  });

  it('never hands a remounted source a key an earlier one used', () => {
    // A palette that remounts starts a new gesture source; its first burst folding into the
    // last undo step of the old one would take both back in one Undo.
    const first = createMarkGesture('restyle')('width', 'm1');
    const again = createMarkGesture('restyle')('width', 'm1');
    expect(again).not.toBe(first);
  });
});
