import { flushSync } from 'react-dom';
import type { IconTable } from '@weasel-js/icons';
import { createKitRoot } from '../kitIcons';
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
import { auditElement } from './a11y';
import { createA11yHighlighter } from './a11yHighlight';
import { createOverrides, resolveCssVar, scanCssVars } from './cssVars';
import { followDocumentScroll } from './documentScroll';
import { createGlobalsTarget, type GlobalsTarget } from './globalsTarget';
import { StoryHost } from './StoryHost';

/** The frame config: what `defineFrameConfig` returns and the `frameConfig` module default-exports. */
export interface FrameSetup {
  /** Wraps every story, outermost; receives the globals. From the frame config (`frameConfig`). */
  decorators?: Decorator[];
  /** Applies globals to a target: theme mode, fonts. The target is a frame document's root, or one story's host in
   *  the workshop document, so a rule the setup writes goes through `target.style` under `target.scope`. */
  applyGlobals?: (globals: Globals, target: GlobalsTarget) => void;
  /**
   * The elements a CSS variable override is declared on; `:root` by default. An override has to be declared on
   * whichever element declares the token itself — a theme wrapper, say — or that element's own value wins.
   */
  cssVarsScope?: string;
  /** Project-wide CSF parameters, Storybook's preview `parameters`: under each meta's and story's. */
  parameters?: Record<string, unknown>;
  /**
   * Awaited once a story is loaded and before it first renders — the place to import what only some stories
   * need, so the rest never load it.
   */
  prepare?: (story: LoadedStory) => void | Promise<void>;
  /** Icon tables registered beside the kit's in every frame: an app's own, for its stories' glyphs. */
  icons?: readonly IconTable[];
}

/** Inputs to `startFrame`: the story, the channel to the shell, and the element to render into. */
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

/** Sends `ready`, then renders the story on `init` and keeps it in step. Returns a stop function. */
export function startFrame({ story, channel, container, setup = {} }: StartFrameOptions): () => void {
  const { send } = channel;
  send({ type: 'ready', schema: describeSchema(story.config), layout: story.layout, viewport: story.viewport });

  const wrapper = document.createElement('div');
  wrapper.className = `fg-frame fg-frame--${story.layout}`;
  container.append(wrapper);
  const root = createKitRoot(wrapper, setup.icons);
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
  const globalsTarget = createGlobalsTarget(document.documentElement, ':root');
  const highlighter = createA11yHighlighter(document);
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
    reportVars();
  };

  const scroll = followDocumentScroll(document, send);

  const audit = async (id: string) => send({ type: 'a11y', id, ...(await auditElement(wrapper)) });

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
          setup.applyGlobals?.(globals, globalsTarget);
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
          setup.applyGlobals?.(globals, globalsTarget);
        });
        break;
      case 'vars.set': {
        overrides.set(msg.name, msg.value);
        const at = lastVars?.findIndex((v) => v.name === msg.name) ?? -1;
        if (!lastVars || at < 0) break;
        const vars = lastVars.slice();
        vars[at] = { ...vars[at]!, value: resolveCssVar(document, msg.name), overridden: overrides.has(msg.name) };
        publishVars(vars);
        break;
      }
      case 'a11y.run':
        void audit(msg.id);
        break;
      case 'a11y.highlight':
        highlighter.show(msg.targets);
        break;
      case 'scroll':
        scroll.apply(msg);
        break;
    }
  });

  return () => {
    off();
    scroll.dispose();
    mutations?.disconnect();
    clearTimeout(settleTimer);
    overrides.dispose();
    globalsTarget.dispose();
    highlighter.dispose();
    root.unmount();
    wrapper.remove();
  };
}

/** Reports an import failure — there is no story to start. */
export function reportImportFault(channel: Channel<ToFrame, FromFrame>, error: unknown): void {
  channel.send(fault('import', error));
}
