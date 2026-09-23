import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { type Channel, openChannel } from '../protocol/channel';
import { FRAME_HELLO, type FromFrame, PORT_HANDOFF, type ToFrame } from '../protocol/messages';

/** The forge test project runs without labkit's setup, and a lab's tiled surface needs a measured, non-zero box. */
export function installResizeObserver(): void {
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const contentRect = { width: 1024, height: 768, x: 0, y: 0, top: 0, left: 0 };
      this.#cb([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const realSetTimeout = globalThis.setTimeout;

/** Yields to the message ports, then lets React commit what they caused. */
export async function flush(): Promise<void> {
  await new Promise((r) => realSetTimeout(r, 0));
  await act(async () => {});
}

/** Plays a frame document's hello, as its entry would once it runs. */
export function sayHello(iframe: HTMLIFrameElement): void {
  const event = new MessageEvent('message', { data: { type: FRAME_HELLO }, origin: location.origin });
  Object.defineProperty(event, 'source', { value: iframe.contentWindow });
  act(() => {
    window.dispatchEvent(event);
  });
}

/** Plays the frame's half of the port handoff for a story iframe. */
export function connectFrame(iframe: HTMLIFrameElement): { frame: Channel<ToFrame, FromFrame>; received: ToFrame[] } {
  const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
  sayHello(iframe);
  const call = (post.mock.calls as unknown[][])
    .filter((c) => (c[0] as { type?: unknown } | null)?.type === PORT_HANDOFF)
    .at(-1);
  const port = (call?.[2] as MessagePort[] | undefined)?.[0];
  if (!port) throw new Error('FrameView handed off no port');
  const frame = openChannel<ToFrame, FromFrame>(port);
  const received: ToFrame[] = [];
  frame.on((msg) => received.push(msg));
  return { frame, received };
}
