import type { FromFrame } from '../protocol/messages';

/** Where a frame document stands, kept in step with the shell. */
export interface DocumentScroll {
  apply(to: { left: number; top: number }): void;
  dispose(): void;
}

/**
 * Reports where `doc` stands, now and on each scroll, and scrolls it where the shell says: the story scrolls the
 * frame document itself, and the shell keeps a lens's copy and a capture on the same patch.
 */
export function followDocumentScroll(doc: Document, send: (msg: FromFrame) => void): DocumentScroll {
  const scroller = doc.scrollingElement ?? doc.documentElement;
  const view = doc.defaultView;
  let reported: string | null = null;
  const report = () => {
    const left = scroller.scrollLeft;
    const top = scroller.scrollTop;
    const key = `${left} ${top}`;
    if (key === reported) return;
    reported = key;
    send({ type: 'scroll', left, top });
  };
  report();
  view?.addEventListener('scroll', report, { passive: true });
  return {
    apply({ left, top }) {
      scroller.scrollLeft = left;
      scroller.scrollTop = top;
    },
    dispose: () => view?.removeEventListener('scroll', report),
  };
}
