import { f } from '@weasel-js/labkit/config';
import { Component, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createKitRoot } from '../../kitIcons';
import type { Channel } from '../../protocol/channel';
import type { FromFrame, StoryGlobals, ToFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import type { IndexBundle } from '../../story/indexBundle';
import { auditElement } from '../a11y';
import type { FrameSetup } from '../FrameController';
import { fault } from '../fault';
import { frameDecorators } from '../frameDecorators';
import { startFrameServices } from '../frameServices';
import { createGlobalsTarget } from '../globalsTarget';
import { indexEnvOf } from './indexEnv';
import { IndexPage } from './IndexPage';

export interface StartIndexOptions {
  bundle: IndexBundle;
  channel: Channel<ToFrame, FromFrame>;
  container: HTMLElement;
  setup?: FrameSetup;
}

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
  const root = createKitRoot(wrapper, setup.icons);
  const globalsTarget = createGlobalsTarget(document.documentElement, ':root');
  const services = startFrameServices(document, send, setup.cssVarsScope);
  let globals: StoryGlobals | null = null;
  let announced = false;
  /** `init`, `config`, `state` and `globals` messages received, as the shell counts them for a fault's `seq`. */
  let seq = 0;

  const render = (): void => {
    if (!globals) return;
    const env = indexEnvOf(options.bundle, {
      graph: null,
      globals,
      decorators: frameDecorators(setup),
      open: (id) => send({ type: 'open', id }),
    });
    root.render(
      <PageBoundary onError={(error) => send(fault('render', error, seq))}>
        <IndexPage env={env} render={options.bundle.render} />
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
    if (services.handle(msg)) return;
    switch (msg.type) {
      case 'config':
      case 'state':
        seq += 1;
        break;
      case 'init':
      case 'globals':
        seq += 1;
        // A throw faults the frame as a story's input does; otherwise the trial would wait on a frame that never answers.
        try {
          globals = msg.globals;
          setup.applyGlobals?.(globals, globalsTarget);
          flushSync(render);
        } catch (error) {
          send(fault('render', error, seq));
          break;
        }
        services.vars.scan();
        announce();
        break;
      case 'a11y.run':
        void auditElement(wrapper).then((outcome) => send({ type: 'a11y', id: msg.id, ...outcome }));
        break;
      default:
        break;
    }
  });

  return () => {
    off();
    services.dispose();
    globalsTarget.dispose();
    root.unmount();
    wrapper.remove();
  };
}
