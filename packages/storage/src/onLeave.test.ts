import { afterEach, describe, expect, it, vi } from 'vitest';
import { onLeave } from './onLeave';

const turn = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => { vi.restoreAllMocks(); });

describe('onLeave', () => {
  it('runs on pagehide and when the page turns hidden, not when it turns visible, and never once stopped', () => {
    const fn = vi.fn();
    const stop = onLeave(fn);
    window.dispatchEvent(new Event('pagehide'));
    turn('hidden');
    turn('visible');
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event('pagehide'));
    turn('hidden');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('with capture, runs ahead of a listener on the document', () => {
    const order: string[] = [];
    const late = (): void => { order.push('document'); };
    document.addEventListener('visibilitychange', late);
    const stop = onLeave(() => order.push('captured'), { capture: true });
    turn('hidden');
    stop();
    document.removeEventListener('visibilitychange', late);
    expect(order).toEqual(['captured', 'document']);
  });
});
