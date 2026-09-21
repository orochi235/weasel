import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Channel } from '../protocol/channel';
import {
  type CssVarReport,
  type FaultPhase,
  type FromFrame,
  type Globals,
  stableStringify,
  type ToFrame,
} from '../protocol/messages';
import { answerSchema, describeSchema } from '../protocol/schema';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';
import { runAxe } from './a11y';
import { captureElement } from './capture';
import { createOverrides, resolveCssVar, scanCssVars } from './cssVars';
import { StoryHost } from './StoryHost';

export interface FrameSetup {
  /** Wraps every story, outermost; receives the globals. From the frame config (`frameConfig`). */
  decorators?: Decorator[];
  /** Applies globals to the frame document — theme mode, fonts. */
  applyGlobals?: (globals: Globals, root: HTMLElement) => void;
  /**
   * The elements a CSS variable override is declared on; `:root` by default. An override has to be declared on
   * whichever element declares the token itself — a theme wrapper, say — or that element's own value wins.
   */
  cssVarsScope?: string;
  /** Project-wide CSF parameters, Storybook's preview `parameters`: under each meta's and story's. */
  parameters?: Record<string, unknown>;
}

export interface StartFrameOptions {
  story: LoadedStory;
  channel: Channel<ToFrame, FromFrame>;
  container: HTMLElement;
  setup?: FrameSetup;
}

const VARS_SETTLE_MS = 100;

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
  let rendered = false;
  let config: unknown;
  let state: unknown = null;
  let globals: Globals = {};
  let answeredKey: string | null = null;
  let resetKey = 0;
  let seq = 0;

  const overrides = createOverrides(document, setup.cssVarsScope);
  let lastVars: CssVarReport[] | null = null;
  let reported: string | null = null;
  const publishVars = (vars: CssVarReport[]) => {
    lastVars = vars;
    const key = JSON.stringify(vars);
    if (key === reported) return;
    reported = key;
    send({ type: 'vars', vars });
  };
  const reportVars = () => publishVars(scanCssVars(document, overrides.has));
  const ownMutation = (record: MutationRecord) =>
    overrides.owns(record.target) ||
    (record.type === 'childList' &&
      [...record.addedNodes, ...record.removedNodes].length > 0 &&
      [...record.addedNodes, ...record.removedNodes].every(overrides.owns));
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const mutations =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          if (records.every(ownMutation)) return;
          clearTimeout(settleTimer);
          settleTimer = setTimeout(reportVars, VARS_SETTLE_MS);
        });
  // Every attribute, not just style and class: a stylesheet can select on any of them, `[data-wzl-mode]` included.
  mutations?.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });

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

  // Input from the trial commits synchronously, so a `play` that follows sees the rendered story. A throw while
  // applying it faults like a render would; otherwise the trial would wait on a frame that never answers.
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
      announceRendered();
    }
    reportVars();
  };

  /**
   * The shell unhides the frame on `rendered` and fades it in, so whatever
   * reflows after that message reads as a glide rather than a jump. A webfont
   * swapping in is the reflow that does it: a `layout: 'padded'` story is
   * top-anchored, so the line-height change walks the whole story upward.
   * Waiting for the fonts and then one painted frame means the story the
   * shell reveals is the settled one.
   *
   * `document.fonts` is absent in jsdom, where there is no paint to wait for
   * and no font to swap — the message stays synchronous there, which is also
   * what `FrameController.test.tsx` observes. The deferral itself is only
   * exercised in a browser.
   */
  const announceRendered = () => {
    const { fonts } = document;
    if (!fonts) {
      send({ type: 'rendered' });
      return;
    }
    const afterPaint = () => requestAnimationFrame(() => send({ type: 'rendered' }));
    void fonts.ready.then(afterPaint, afterPaint);
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

  const audit = async (id: string) => {
    try {
      send({ type: 'a11y', id, ok: true, report: await runAxe(wrapper) });
    } catch (error) {
      send({ type: 'a11y', id, ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const picture = (id: string) => {
    try {
      send({ type: 'capture', id, ok: true, picture: captureElement(wrapper) });
    } catch (error) {
      send({ type: 'capture', id, ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const off = channel.on((msg) => {
    switch (msg.type) {
      case 'init':
        input(() => {
          initialized = true;
          config = msg.config;
          globals = msg.globals;
          state = msg.state;
          if (state === null && story.initialState) {
            state = story.initialState(config);
            send({ type: 'setState', state });
          }
          setup.applyGlobals?.(globals, document.documentElement);
        });
        break;
      case 'config':
        input(() => {
          config = msg.config;
        });
        break;
      case 'state':
        input(() => {
          state = msg.state;
        });
        break;
      case 'globals':
        input(() => {
          globals = msg.globals;
          setup.applyGlobals?.(globals, document.documentElement);
        });
        break;
      case 'vars.set': {
        overrides.set(msg.name, msg.value);
        const at = lastVars?.findIndex((v) => v.name === msg.name) ?? -1;
        if (!lastVars || at < 0) break;
        const vars = lastVars.slice();
        vars[at] = { name: msg.name, value: resolveCssVar(document, msg.name), overridden: overrides.has(msg.name) };
        publishVars(vars);
        break;
      }
      case 'play':
        void play();
        break;
      case 'a11y.run':
        void audit(msg.id);
        break;
      case 'capture.run':
        picture(msg.id);
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
    mutations?.disconnect();
    clearTimeout(settleTimer);
    overrides.dispose();
    root.unmount();
    wrapper.remove();
  };
}

/** Reports an import failure — there is no story to start. */
export function reportImportFault(channel: Channel<ToFrame, FromFrame>, error: unknown): void {
  channel.send(fault('import', error));
}
