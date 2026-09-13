import { type FrameSetup, startFrame } from '../frame/FrameController';
import { loadStories } from '../frame/mountFrame';
import { type Channel, openChannel } from '../protocol/channel';
import type { FromFrame, ToFrame, Viewport } from '../protocol/messages';

type Received<T extends FromFrame['type']> = Extract<FromFrame, { type: T }>;

/** Prefixes `error` with the phase it came from, keeping its stack. */
function phased(phase: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const out = new Error(`${phase} fault: ${message}`, { cause: error });
  if (error instanceof Error && error.stack) out.stack = `${phase} fault: ${error.stack}`;
  return out;
}

function inbox(channel: Channel<FromFrame, ToFrame>) {
  const received: FromFrame[] = [];
  let failure: Error | null = null;
  const wake = new Set<() => void>();
  const off = channel.on((msg) => {
    if (msg.type === 'fault' && !failure) {
      failure = new Error(`${msg.phase} fault: ${msg.message}`);
      if (msg.stack) failure.stack = `${msg.phase} fault: ${msg.stack}`;
    }
    received.push(msg);
    for (const fn of [...wake]) fn();
  });

  const check = () => {
    if (failure) throw failure;
  };

  const next = <T extends FromFrame['type']>(type: T): Promise<Received<T>> =>
    new Promise((resolve, reject) => {
      const poll = () => {
        if (failure) {
          wake.delete(poll);
          reject(failure);
          return;
        }
        const at = received.findIndex((m) => m.type === type);
        if (at === -1) return;
        wake.delete(poll);
        resolve(received.splice(at, 1)[0] as Received<T>);
      };
      wake.add(poll);
      poll();
    });

  /** The first fault, if one arrives by the next macrotask. */
  const fault = (): Promise<Error | null> =>
    new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        wake.delete(onMessage);
        resolve(failure);
      };
      const onMessage = () => {
        if (failure) done();
      };
      const timer = setTimeout(done, 0);
      wake.add(onMessage);
      onMessage();
    });

  return { next, check, fault, close: off };
}

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

export interface RunStoryOptions {
  /** forge.config's `frame` half. */
  setup?: FrameSetup;
  /** Resizes the page, for a story that names a viewport. Without it, stories run at whatever size the page is. */
  viewport?: (width: number, height: number) => Promise<void>;
}

/** Stops the story a timed-out test left mounted. */
let leftover: (() => unknown) | null = null;
/** The page's size before any story resized it; a story with no viewport runs at this size. */
let pageSize: Viewport | null = null;

/**
 * Renders one story the way the workshop's frame does — defaults, no state, no globals — then plays it.
 * Throws on any fault the frame reports, or a play function that fails.
 */
export async function runStory(
  mod: Record<string, unknown>,
  exportName: string,
  file: string,
  root: string,
  { setup, viewport }: RunStoryOptions = {},
): Promise<void> {
  leftover?.();
  let story: ReturnType<typeof loadStories>[number] | undefined;
  try {
    story = loadStories(mod, file, root).find((s) => s.exportName === exportName);
  } catch (error) {
    throw phased('load', error);
  }
  if (!story) throw new Error(`load fault: ${file} has no story export "${exportName}"`);

  pageSize ??= { width: window.innerWidth, height: window.innerHeight };
  const size = story.viewport ?? pageSize;
  if (viewport && (window.innerWidth !== size.width || window.innerHeight !== size.height)) {
    await viewport(size.width, size.height);
  }

  const { port1, port2 } = new MessageChannel();
  const shell = openChannel<FromFrame, ToFrame>(port1);
  const frame = openChannel<ToFrame, FromFrame>(port2);
  const messages = inbox(shell);
  const container = document.createElement('div');
  document.body.append(container);
  let stopFrame: (() => void) | undefined;
  /** Returns what `stopFrame` threw, having released everything else regardless. */
  const cleanup = (): { error: unknown } | null => {
    if (leftover === cleanup) leftover = null;
    let thrown: { error: unknown } | null = null;
    try {
      messages.close();
      stopFrame?.();
    } catch (error) {
      thrown = { error };
    } finally {
      stopFrame = undefined;
      shell.close();
      frame.close();
      container.remove();
    }
    return thrown;
  };
  leftover = cleanup;

  let failure: { error: unknown } | null = null;
  try {
    try {
      stopFrame = startFrame({ story, channel: frame, container, setup });
    } catch (error) {
      throw phased('mount', error);
    }
    await messages.next('ready');
    shell.send({ type: 'init', config: story.config.defaults(), state: null, globals: {} });
    await messages.next('answers');
    await settle();
    messages.check();
    if (story.play) {
      shell.send({ type: 'play' });
      const played = await messages.next('played');
      if (!played.ok) throw (await messages.fault()) ?? new Error(`play fault: ${played.message ?? 'failed'}`);
      await settle();
    }
    messages.check();
  } catch (error) {
    failure = { error };
  }
  const cleanupError = cleanup();
  if (failure) throw failure.error;
  if (cleanupError) throw phased('cleanup', cleanupError.error);
}
