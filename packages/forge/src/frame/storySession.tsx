import { flushSync } from 'react-dom';
import type { createKitRoot } from '../kitIcons';
import { type FromFrame, type StoryGlobals, stableStringify, type ToFrame } from '../protocol/messages';
import { answerSchema } from '../protocol/schema';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';
import { fault } from './fault';
import { StoryHost } from './StoryHost';

/** What a story session renders with: the story, where it renders, and how it reaches the shell. */
export interface StorySessionOptions {
  story: LoadedStory;
  root: ReturnType<typeof createKitRoot>;
  decorators: readonly Decorator[];
  send: (msg: FromFrame) => void;
  /** Applies the globals the trial sent to the document. */
  applyGlobals: (globals: StoryGlobals) => void;
  /** Called after each input has committed its render. */
  onCommit: () => void;
}

/** The trial's inputs to one story, each applied and committed synchronously. */
export interface StorySession {
  init(msg: Extract<ToFrame, { type: 'init' }>): void;
  setConfig(config: unknown): void;
  setState(state: unknown): void;
  setGlobals(globals: StoryGlobals): void;
}

/**
 * The shell unhides the frame on `rendered` and fades it in, so a webfont
 * swapping in after that message reads as the story gliding. Waiting for the
 * fonts and then one painted frame means the story the shell reveals is the
 * settled one.
 *
 * `document.fonts` is absent in jsdom, so the message stays synchronous
 * there; the deferral is only exercised in a browser.
 */
function announceRendered(send: (msg: FromFrame) => void): void {
  const { fonts } = document;
  if (!fonts) {
    send({ type: 'rendered' });
    return;
  }
  const afterPaint = () => requestAnimationFrame(() => send({ type: 'rendered' }));
  void fonts.ready.then(afterPaint, afterPaint);
}

/** Holds one story's config, state and globals, and renders it each time the trial changes one. */
export function createStorySession({
  story,
  root,
  decorators,
  send,
  applyGlobals,
  onCommit,
}: StorySessionOptions): StorySession {
  let initialized = false;
  let rendered = false;
  let config: unknown;
  let state: unknown = null;
  let globals: StoryGlobals = {};
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

  // Input from the trial commits synchronously, so `rendered` and the vars report describe the story it produced. A
  // throw while applying it faults like a render would; otherwise the trial would wait on a frame that never answers.
  const input = (apply: () => void) => {
    seq += 1;
    try {
      apply();
      if (!initialized) return;
      resetKey += 1;
      flushSync(render);
    } catch (error) {
      send(fault('render', error, seq));
      return;
    }
    if (!rendered) {
      rendered = true;
      announceRendered(send);
    }
    onCommit();
  };

  return {
    init: (msg) =>
      input(() => {
        initialized = true;
        config = msg.config;
        globals = msg.globals;
        state = msg.state;
        if (state === null && story.initialState) {
          state = story.initialState(config);
          send({ type: 'setState', state });
        }
        applyGlobals(globals);
      }),
    setConfig: (next) =>
      input(() => {
        config = next;
      }),
    setState: (next) =>
      input(() => {
        state = next;
      }),
    setGlobals: (next) =>
      input(() => {
        globals = next;
        applyGlobals(globals);
      }),
  };
}
