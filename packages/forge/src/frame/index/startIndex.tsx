import { f } from '@weasel-js/labkit/config';
import { Component, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Channel } from '../../protocol/channel';
import type { FromFrame, Globals, ToFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import type { IndexRender, LoadedStory } from '../../story/types';
import { runAxe } from '../a11y';
import { captureElement } from '../capture';
import type { FrameSetup } from '../FrameController';
import { createGlobalsTarget } from '../globalsTarget';
import { type IndexEnv, IndexPage } from './IndexPage';
import './index.css';

export interface StartIndexOptions {
  title: string;
  description?: string;
  /** In file order. */
  stories: readonly LoadedStory[];
  descriptions: Readonly<Record<string, string>>;
  /** The component's own page; null for the generated one. */
  render: IndexRender | null;
  channel: Channel<ToFrame, FromFrame>;
  container: HTMLElement;
  setup?: FrameSetup;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Faults the frame when the page itself throws. A single story's throw stays in its own cell. */
class PageBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: unknown }> {
  override state = { failed: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error ?? new Error('Index page failed') };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Sends `ready` for a page with no controls, then renders the component's index on `init` and follows the lab's
 * globals. Returns a stop function.
 */
export function startIndex(options: StartIndexOptions): () => void {
  const { channel, container, setup = {} } = options;
  const { send } = channel;
  send({ type: 'ready', schema: describeSchema(f.schema({})), layout: 'fullscreen', viewport: null });

  const wrapper = document.createElement('div');
  wrapper.className = 'fg-frame fg-frame--fullscreen';
  container.append(wrapper);
  const root = createRoot(wrapper);
  const globalsTarget = createGlobalsTarget(document.documentElement, ':root');
  let globals: Globals | null = null;
  let announced = false;

  const render = (): void => {
    if (!globals) return;
    const env: IndexEnv = {
      title: options.title,
      ...(options.description === undefined ? {} : { description: options.description }),
      stories: options.stories,
      descriptions: options.descriptions,
      globals,
      decorators: setup.decorators ?? [],
      open: (id) => send({ type: 'open', id }),
      // A story that throws shows its error in its own cell; the rest of the page is still worth reading.
      onError: (error) => console.error(error),
    };
    root.render(
      <PageBoundary onError={(error) => send({ type: 'fault', phase: 'render', message: message(error) })}>
        <IndexPage env={env} render={options.render} />
      </PageBoundary>,
    );
  };

  const announce = (): void => {
    if (announced) return;
    announced = true;
    const { fonts } = document;
    if (!fonts) {
      send({ type: 'rendered' });
      return;
    }
    const afterPaint = () => requestAnimationFrame(() => send({ type: 'rendered' }));
    void fonts.ready.then(afterPaint, afterPaint);
  };

  const off = channel.on((msg) => {
    switch (msg.type) {
      case 'init':
      case 'globals':
        globals = msg.globals;
        setup.applyGlobals?.(globals, globalsTarget);
        flushSync(render);
        announce();
        break;
      case 'a11y.run':
        runAxe(wrapper).then(
          (report) => send({ type: 'a11y', id: msg.id, ok: true, report }),
          (error: unknown) => send({ type: 'a11y', id: msg.id, ok: false, message: message(error) }),
        );
        break;
      case 'capture.run':
        try {
          send({ type: 'capture', id: msg.id, ok: true, picture: captureElement(wrapper) });
        } catch (error) {
          send({ type: 'capture', id: msg.id, ok: false, message: message(error) });
        }
        break;
      default:
        break;
    }
  });

  return () => {
    off();
    globalsTarget.dispose();
    root.unmount();
    wrapper.remove();
  };
}
