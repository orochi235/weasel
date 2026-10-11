import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAME_HELLO } from '../protocol/messages';
import { createFramePool, type FramePool, HELLO_TIMEOUT_MS } from './framePool';

const proto = Element.prototype as Element & { moveBefore?: unknown };

function hello(frame: HTMLIFrameElement) {
  const event = new MessageEvent('message', { data: { type: FRAME_HELLO }, origin: location.origin });
  Object.defineProperty(event, 'source', { value: frame.contentWindow });
  window.dispatchEvent(event);
}

/** Long enough for the pool's idle refill, and well short of its wait for a frame's hello. */
const idle = () => vi.advanceTimersByTime(1000);

const shelved = () => [...document.querySelectorAll<HTMLIFrameElement>('.fg-frame-pool > iframe')];

describe('createFramePool', () => {
  let pool: FramePool | null = null;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    pool?.dispose();
    pool = null;
    Reflect.deleteProperty(proto, 'moveBefore');
    vi.useRealTimers();
  });

  it('loads nothing and claims nothing where an iframe cannot be moved without reloading', () => {
    pool = createFramePool('/frame.html', 1);
    idle();
    expect(shelved()).toHaveLength(0);
    expect(pool.claim()).toBeNull();
  });

  it('hands out a blank frame only once it has said hello, and never the same one twice', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    idle();
    const [frame] = shelved();
    expect(frame?.getAttribute('src')).toBe('/frame.html');
    expect(pool.claim()).toBeNull();
    hello(frame as HTMLIFrameElement);
    expect(pool.claim()).toBe(frame);
    expect(pool.claim()).toBeNull();
  });

  it('loads a replacement when idle after a claim', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    idle();
    const [first] = shelved();
    hello(first as HTMLIFrameElement);
    const claimed = pool.claim();
    claimed?.remove();
    expect(shelved()).toHaveLength(0);
    idle();
    expect(shelved()).toHaveLength(1);
    expect(shelved()[0]).not.toBe(first);
  });

  it('stops listening for a frame that had not said hello when disposed', () => {
    proto.moveBefore = () => {};
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    pool = createFramePool('/frame.html', 2);
    idle();
    const listeners = added.mock.calls.filter(([type]) => type === 'message').map(([, listener]) => listener);
    expect(listeners).toHaveLength(2);
    pool.dispose();
    expect(removed.mock.calls.filter(([type]) => type === 'message').map(([, listener]) => listener)).toEqual(listeners);
  });

  it('gives up on a frame that never says hello, and loads another in its place', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    idle();
    const [stuck] = shelved();
    expect(stuck).toBeDefined();
    vi.advanceTimersByTime(HELLO_TIMEOUT_MS + 1000);
    const [next] = shelved();
    expect(shelved()).toHaveLength(1);
    expect(next).not.toBe(stuck);
    hello(next as HTMLIFrameElement);
    expect(pool.claim()).toBe(next);
  });

  it('takes its frames out of the document when disposed', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    idle();
    pool.dispose();
    expect(document.querySelector('.fg-frame-pool')).toBeNull();
  });
});
