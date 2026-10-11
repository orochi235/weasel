import { createContext } from 'react';
import { FRAME_HELLO } from '../protocol/messages';

/** Frame documents loaded ahead of need, blank until a view hands one a port. */
export interface FramePool {
  /**
   * A frame that has loaded and said hello, detached from the pool so the caller can move it into place with
   * `moveBefore`; null when none is ready or the browser cannot move an iframe without reloading it.
   */
  claim(): HTMLIFrameElement | null;
  dispose(): void;
}

/** How long a frame document has to say hello. Longer than a cold dev server takes to serve one its first time. */
export const HELLO_TIMEOUT_MS = 30_000;

type Movable = Element & { moveBefore(node: Node, child: Node | null): void };

/** Whether `moveBefore` exists here, the one way to move an iframe without reloading its document. */
export function canMoveFrames(): boolean {
  return typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;
}

/** Moves `frame` to the start of `host` without reloading it. */
export function moveFrame(host: Element, frame: HTMLIFrameElement): void {
  (host as Movable).moveBefore(frame, host.firstChild);
}

const whenIdle = (fn: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(fn, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(fn, 200);
  return () => clearTimeout(handle);
};

/**
 * Keeps `size` blank frames of `frameUrl` loaded off-screen. A claimed frame is the caller's to discard: it never
 * comes back, so nothing one story left in a document reaches the next. A replacement loads when the page is idle.
 */
export function createFramePool(frameUrl: string, size = 2): FramePool {
  const shelf = document.createElement('div');
  shelf.className = 'fg-frame-pool';
  shelf.setAttribute('aria-hidden', 'true');
  document.body.append(shelf);
  const warm: HTMLIFrameElement[] = [];
  /** Per frame still loading, what stops waiting for it. */
  const waits = new Set<() => void>();
  let cancelRefill: (() => void) | null = null;
  let disposed = false;

  const load = () => {
    const frame = document.createElement('iframe');
    frame.tabIndex = -1;
    frame.src = frameUrl;
    const stop = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      waits.delete(stop);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      if ((event.data as { type?: unknown } | null)?.type !== FRAME_HELLO) return;
      stop();
      warm.push(frame);
    };
    const timer = setTimeout(() => {
      stop();
      frame.remove();
      refill();
    }, HELLO_TIMEOUT_MS);
    waits.add(stop);
    window.addEventListener('message', onMessage);
    shelf.append(frame);
  };

  const refill = () => {
    if (disposed || cancelRefill) return;
    cancelRefill = whenIdle(() => {
      cancelRefill = null;
      while (!disposed && warm.length + waits.size < size) load();
    });
  };
  if (canMoveFrames()) refill();

  return {
    claim() {
      if (!canMoveFrames()) return null;
      const frame = warm.shift() ?? null;
      refill();
      return frame;
    },
    dispose() {
      disposed = true;
      cancelRefill?.();
      for (const stop of [...waits]) stop();
      shelf.remove();
    },
  };
}

export const FramePoolContext = createContext<FramePool | null>(null);
