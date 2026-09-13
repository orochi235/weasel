import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Channel } from '../protocol/channel';
import { type FaultPhase, type FromFrame, type Globals, stableStringify, type ToFrame } from '../protocol/messages';
import { answerSchema, describeSchema } from '../protocol/schema';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';
import { StoryHost } from './StoryHost';

export interface FrameSetup {
  /** Wraps every story, outermost; receives the globals. From forge.config's `frame` half. */
  decorators?: Decorator[];
  /** Applies globals to the frame document — theme mode, fonts. */
  applyGlobals?: (globals: Globals, root: HTMLElement) => void;
}

export interface StartFrameOptions {
  story: LoadedStory;
  channel: Channel<ToFrame, FromFrame>;
  container: HTMLElement;
  setup?: FrameSetup;
}

function fault(phase: FaultPhase, error: unknown, seq?: number): FromFrame {
  return {
    type: 'fault',
    phase,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...(seq === undefined ? {} : { seq }),
  };
}

/** Sends `ready`, then renders the story on `init` and keeps it in step. Returns a stop function. */
export function startFrame({ story, channel, container, setup = {} }: StartFrameOptions): () => void {
  const { send } = channel;
  send({ type: 'ready', schema: describeSchema(story.config), layout: story.layout, viewport: story.viewport });

  const wrapper = document.createElement('div');
  wrapper.className = `fg-frame fg-frame--${story.layout}`;
  container.append(wrapper);
  const root = createRoot(wrapper);
  const decorators = setup.decorators ?? [];

  let initialized = false;
  let config: unknown;
  let state: unknown = null;
  let globals: Globals = {};
  let answeredKey: string | null = null;
  let resetKey = 0;
  let seq = 0;

  const setConfig = (path: string, value: unknown) => send({ type: 'setConfig', path, value });
  const setState = (next: unknown) => {
    state = typeof next === 'function' ? (next as (prev: unknown) => unknown)(state) : next;
    send({ type: 'setState', state });
    render();
  };

  const render = () => {
    const ctx: StoryContext = { config, setConfig, state, setState, globals, title: story.title, name: story.name };
    const at = seq;
    root.render(
      <StoryHost
        story={story}
        ctx={ctx}
        decorators={decorators}
        resetKey={resetKey}
        onError={(error) => send(fault('render', error, at))}
      />,
    );
    const key = stableStringify(config);
    if (key !== answeredKey) {
      answeredKey = key;
      send({ type: 'answers', answers: { configKey: key, ...answerSchema(story.config, config) } });
    }
  };

  // Input from the trial commits synchronously, so a `play` that follows sees the rendered story.
  const renderInput = () => {
    seq += 1;
    if (!initialized) return;
    resetKey += 1;
    flushSync(render);
  };

  const play = async () => {
    try {
      await story.play?.({ canvasElement: wrapper, config, globals });
      send({ type: 'played', ok: true });
    } catch (error) {
      send({ type: 'played', ok: false, message: error instanceof Error ? error.message : String(error) });
      send(fault('play', error));
    }
  };

  const off = channel.on((msg) => {
    switch (msg.type) {
      case 'init':
        initialized = true;
        config = msg.config;
        globals = msg.globals;
        state = msg.state;
        if (state === null && story.initialState) {
          state = story.initialState(config);
          send({ type: 'setState', state });
        }
        setup.applyGlobals?.(globals, document.documentElement);
        renderInput();
        break;
      case 'config':
        config = msg.config;
        renderInput();
        break;
      case 'state':
        state = msg.state;
        renderInput();
        break;
      case 'globals':
        globals = msg.globals;
        setup.applyGlobals?.(globals, document.documentElement);
        renderInput();
        break;
      case 'play':
        void play();
        break;
    }
  });

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          const { width, height } = wrapper.getBoundingClientRect();
          send({ type: 'size', width: Math.ceil(width), height: Math.ceil(height) });
        });
  observer?.observe(wrapper);

  return () => {
    off();
    observer?.disconnect();
    root.unmount();
    wrapper.remove();
  };
}

/** Reports an import failure — there is no story to start. */
export function reportImportFault(channel: Channel<ToFrame, FromFrame>, error: unknown): void {
  channel.send(fault('import', error));
}
