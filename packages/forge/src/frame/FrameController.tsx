import type { IconTable } from '@weasel-js/icons';
import { createKitRoot } from '../kitIcons';
import type { Channel } from '../protocol/channel';
import type { FromFrame, StoryGlobals, ToFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { Decorator, LoadedStory } from '../story/types';
import { auditElement } from './a11y';
import { createA11yHighlighter } from './a11yHighlight';
import { createOverrides } from './cssVars';
import { watchCssVars } from './cssVarsWatch';
import { followDocumentScroll } from './documentScroll';
import { fault } from './fault';
import { createGlobalsTarget, type GlobalsTarget } from './globalsTarget';
import { frameDecorators } from './frameDecorators';
import { createStorySession } from './storySession';

/** The frame config: what `defineFrameConfig` returns and the `frameConfig` module default-exports. */
export interface FrameSetup {
  /** Wraps every story, outermost; receives the globals. From the frame config (`frameConfig`). */
  decorators?: Decorator[];
  /** Applies globals to a target: theme mode, fonts. The target is a frame document's root, or one story's host in
   *  the workshop document, so a rule the setup writes goes through `target.style` under `target.scope`. */
  applyGlobals?: (globals: StoryGlobals, target: GlobalsTarget) => void;
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
  /**
   * Register each story's canvases with the devtools hook, as `<Lab devtools>` does: by default in a development
   * build only, unless a `devtools` entry provided above the story says otherwise. `false` withholds it; `true` mounts
   * it in a production build too.
   */
  devtools?: boolean;
}

/** Inputs to `startFrame`: the story, the channel to the shell, and the element to render into. */
export interface StartFrameOptions {
  story: LoadedStory;
  channel: Channel<ToFrame, FromFrame>;
  container: HTMLElement;
  setup?: FrameSetup;
}

/** Sends `ready`, then renders the story on `init` and keeps it in step. Returns a stop function. */
export function startFrame({ story, channel, container, setup = {} }: StartFrameOptions): () => void {
  const { send } = channel;
  send({ type: 'ready', schema: describeSchema(story.config), layout: story.layout, viewport: story.viewport });

  const wrapper = document.createElement('div');
  wrapper.className = `fg-frame fg-frame--${story.layout}`;
  container.append(wrapper);
  const root = createKitRoot(wrapper, setup.icons);

  const overrides = createOverrides(document, setup.cssVarsScope);
  const globalsTarget = createGlobalsTarget(document.documentElement, ':root');
  const highlighter = createA11yHighlighter(document);
  const vars = watchCssVars(document, overrides, (report) => send({ type: 'vars', vars: report }), {
    under: document.documentElement,
  });
  const session = createStorySession({
    story,
    root,
    decorators: frameDecorators(setup),
    send,
    applyGlobals: (globals: StoryGlobals) => setup.applyGlobals?.(globals, globalsTarget),
    onCommit: () => vars.scan(),
  });

  const scroll = followDocumentScroll(document, send);

  const audit = async (id: string) => send({ type: 'a11y', id, ...(await auditElement(wrapper)) });

  const off = channel.on((msg) => {
    switch (msg.type) {
      case 'init':
        session.init(msg);
        break;
      case 'config':
        session.setConfig(msg.config);
        break;
      case 'state':
        session.setState(msg.state);
        break;
      case 'globals':
        session.setGlobals(msg.globals);
        break;
      case 'vars.set': {
        overrides.set(msg.name, msg.value);
        vars.revise(msg.name);
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
    vars.dispose();
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
