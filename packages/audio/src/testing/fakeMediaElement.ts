import type { FakeNode } from './fakeNode';

export interface FakeMediaSource extends FakeNode { mediaElement: FakeMediaElement }

/** Enough of an `HTMLMediaElement` for a streaming voice. `play()` resolves
 *  unless `_rejectPlay` is set; `_fire` dispatches a media event. */
export interface FakeMediaElement {
  src: string;
  loop: boolean;
  currentTime: number;
  playbackRate: number;
  paused: boolean;
  crossOrigin: string | null;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  _fire(type: string): void;
  _rejectPlay: Error | null;
  _listenerCount(): number;
}

export function createFakeMediaElement(src = ''): FakeMediaElement {
  const listeners = new Map<string, Set<() => void>>();
  const el: FakeMediaElement = {
    src, loop: false, currentTime: 0, playbackRate: 1, paused: true,
    crossOrigin: null, preload: 'auto',
    play() {
      if (el._rejectPlay) return Promise.reject(el._rejectPlay);
      el.paused = false;
      return Promise.resolve();
    },
    pause() { el.paused = true; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    _fire(type) {
      if (type === 'ended') el.paused = true;
      for (const fn of [...(listeners.get(type) ?? [])]) fn();
    },
    _rejectPlay: null,
    _listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  return el;
}
