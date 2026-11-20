import type { ToFrame } from '../protocol/messages';
import { createA11yHighlighter } from './a11yHighlight';

/** What every frame document answers alike, a story's or an index page's. */
export interface FrameServices {
  /** Handles `msg` if it is one of the messages answered here; false leaves it to the caller. */
  handle(msg: ToFrame): boolean;
  dispose(): void;
}

export function startFrameServices(doc: Document): FrameServices {
  const highlighter = createA11yHighlighter(doc);
  return {
    handle(msg) {
      switch (msg.type) {
        case 'a11y.highlight':
          highlighter.show(msg.targets);
          return true;
        default:
          return false;
      }
    },
    dispose() {
      highlighter.dispose();
    },
  };
}
