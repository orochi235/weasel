import type { FromFrame, ToFrame } from '../protocol/messages';
import { createA11yHighlighter } from './a11yHighlight';
import { followDocumentScroll } from './documentScroll';

/** What every frame document answers alike, a story's or an index page's. */
export interface FrameServices {
  /** Handles `msg` if it is one of the messages answered here; false leaves it to the caller. */
  handle(msg: ToFrame): boolean;
  dispose(): void;
}

/** Outlines a11y findings, and reports and follows the document's scroll. Call after sending `ready`. */
export function startFrameServices(doc: Document, send: (msg: FromFrame) => void): FrameServices {
  const highlighter = createA11yHighlighter(doc);
  const scroll = followDocumentScroll(doc, send);
  return {
    handle(msg) {
      switch (msg.type) {
        case 'a11y.highlight':
          highlighter.show(msg.targets);
          return true;
        case 'scroll':
          scroll.apply(msg);
          return true;
        default:
          return false;
      }
    },
    dispose() {
      scroll.dispose();
      highlighter.dispose();
    },
  };
}
