import { afterEach, describe, expect, it, vi } from 'vitest';
import { install3dWatch, watch3d } from './watch3d';

function announce(trialId: string): void {
  const host = document.createElement('div');
  host.setAttribute('data-trial-id', trialId);
  const canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  const hook = (globalThis as { __THREE_DEVTOOLS__?: EventTarget }).__THREE_DEVTOOLS__;
  hook?.dispatchEvent(new CustomEvent('observe', { detail: { domElement: canvas } }));
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('watch3d', () => {
  it('a second call of an unsubscribe leaves a later subscription in place', () => {
    vi.useFakeTimers();
    install3dWatch();
    const first = vi.fn();
    const stop = watch3d('t1', first);
    stop();
    const later = vi.fn();
    watch3d('t1', later);
    stop();
    announce('t1');
    vi.runAllTimers();
    expect(first).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledWith('a three.js renderer');
  });
});
