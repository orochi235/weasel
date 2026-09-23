import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAME_HELLO } from '../protocol/messages';
import { createFramePool, type FramePool } from './framePool';

const proto = Element.prototype as Element & { moveBefore?: unknown };

function hello(frame: HTMLIFrameElement) {
  const event = new MessageEvent('message', { data: { type: FRAME_HELLO }, origin: location.origin });
  Object.defineProperty(event, 'source', { value: frame.contentWindow });
  window.dispatchEvent(event);
}

const shelved = () => [...document.querySelectorAll<HTMLIFrameElement>('.fg-frame-pool > iframe')];

describe('createFramePool', () => {
  let pool: FramePool | null = null;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    pool?.dispose();
    pool = null;
    delete proto.moveBefore;
    vi.useRealTimers();
  });

  it('loads nothing and claims nothing where an iframe cannot be moved without reloading', () => {
    pool = createFramePool('/frame.html', 1);
    vi.runAllTimers();
    expect(shelved()).toHaveLength(0);
    expect(pool.claim()).toBeNull();
  });

  it('hands out a blank frame only once it has said hello, and never the same one twice', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    vi.runAllTimers();
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
    vi.runAllTimers();
    const [first] = shelved();
    hello(first as HTMLIFrameElement);
    const claimed = pool.claim();
    claimed?.remove();
    expect(shelved()).toHaveLength(0);
    vi.runAllTimers();
    expect(shelved()).toHaveLength(1);
    expect(shelved()[0]).not.toBe(first);
  });

  it('takes its frames out of the document when disposed', () => {
    proto.moveBefore = () => {};
    pool = createFramePool('/frame.html', 1);
    vi.runAllTimers();
    pool.dispose();
    expect(document.querySelector('.fg-frame-pool')).toBeNull();
  });
});
