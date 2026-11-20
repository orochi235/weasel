import type { FromFrame, ToFrame } from '../protocol/messages';
import { createA11yHighlighter } from './a11yHighlight';
import { createOverrides } from './cssVars';
import { type CssVarsWatch, watchCssVars } from './cssVarsWatch';
import { followDocumentScroll } from './documentScroll';

/** What every frame document answers alike, a story's or an index page's. */
export interface FrameServices {
  /** The vars report; scan it once a render commits. */
  vars: CssVarsWatch;
  /** Handles `msg` if it is one of the messages answered here; false leaves it to the caller. */
  handle(msg: ToFrame): boolean;
  dispose(): void;
}

/**
 * Applies CSS variable overrides under `cssVarsScope` and reports the vars, outlines a11y findings, and reports and
 * follows the document's scroll. Call after sending `ready`.
 */
export function startFrameServices(doc: Document, send: (msg: FromFrame) => void, cssVarsScope?: string): FrameServices {
  const overrides = createOverrides(doc, cssVarsScope);
  const vars = watchCssVars(doc, overrides, (report) => send({ type: 'vars', vars: report }), {
    under: doc.documentElement,
  });
  const highlighter = createA11yHighlighter(doc);
  const scroll = followDocumentScroll(doc, send);
  return {
    vars,
    handle(msg) {
      switch (msg.type) {
        case 'vars.set':
          overrides.set(msg.name, msg.value);
          vars.revise(msg.name);
          return true;
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
      vars.dispose();
      overrides.dispose();
    },
  };
}
