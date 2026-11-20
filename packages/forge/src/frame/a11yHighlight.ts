/** Outlines over the elements an axe finding names, drawn in the document that holds them. */
export interface A11yHighlighter {
  /** Outlines every element `targets` reaches, replacing what was shown; an empty list clears. */
  show(targets: readonly (readonly string[])[]): void;
  dispose(): void;
}

const CSS = `[data-fg-a11y-highlight] {
  position: fixed;
  z-index: var(--wzl-z-drag, 10000);
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--wzl-danger, #e5484d);
  border-radius: 2px;
  background: color-mix(in srgb, var(--wzl-danger, #e5484d) 15%, transparent);
}
`;

/** The element an axe target reaches: each entry after the first steps into the frame or shadow root before it. */
export function resolveTarget(doc: Document, target: readonly string[]): Element | null {
  let scope: Document | ShadowRoot = doc;
  let found: Element | null = null;
  for (const selector of target) {
    try {
      found = scope.querySelector(selector);
    } catch {
      return null;
    }
    if (!found) return null;
    const inner: Document | ShadowRoot | null | undefined =
      found.shadowRoot ?? (found as HTMLIFrameElement).contentDocument;
    if (inner) scope = inner;
  }
  return found;
}

/** The frame elements between `el` and `doc`, innermost first: each one's document holds the next. */
function framesBetween(doc: Document, el: Element): Element[] {
  const frames: Element[] = [];
  for (let at = el.ownerDocument; at !== doc; ) {
    const frame = at.defaultView?.frameElement;
    if (!frame) break;
    frames.push(frame);
    at = frame.ownerDocument;
  }
  return frames;
}

/** `el`'s rect in `doc`'s viewport: an element inside a frame is offset by each frame's content box. */
function rectIn(doc: Document, el: Element): { left: number; top: number; width: number; height: number } {
  const { left, top, width, height } = el.getBoundingClientRect();
  let x = left;
  let y = top;
  for (const frame of framesBetween(doc, el)) {
    const at = frame.getBoundingClientRect();
    const style = frame.ownerDocument.defaultView?.getComputedStyle(frame);
    x += at.left + frame.clientLeft + (parseFloat(style?.paddingLeft ?? '') || 0);
    y += at.top + frame.clientTop + (parseFloat(style?.paddingTop ?? '') || 0);
  }
  return { left: x, top: y, width, height };
}

export function createA11yHighlighter(doc: Document): A11yHighlighter {
  let style: HTMLStyleElement | null = null;
  let boxes: { el: Element; box: HTMLElement }[] = [];
  /** `doc`'s window and every frame's a box's element sits in: a scroll in any of them moves the element. */
  let views: Window[] = [];

  const place = () => {
    for (const { el, box } of boxes) {
      const rect = rectIn(doc, el);
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    }
  };

  const clear = () => {
    for (const { box } of boxes) box.remove();
    boxes = [];
    for (const view of views) {
      view.removeEventListener('scroll', place, true);
      view.removeEventListener('resize', place);
    }
    views = [];
  };

  return {
    show(targets) {
      clear();
      const elements = targets.map((target) => resolveTarget(doc, target)).filter((el) => el !== null);
      if (elements.length === 0) return;
      if (!style) {
        style = doc.createElement('style');
        style.setAttribute('data-fg-a11y-highlight-style', '');
        style.textContent = CSS;
        doc.head.append(style);
      }
      boxes = elements.map((el) => {
        const box = doc.createElement('div');
        box.setAttribute('data-fg-a11y-highlight', '');
        box.setAttribute('aria-hidden', 'true');
        doc.body.append(box);
        return { el, box };
      });
      place();
      const docs = new Set<Document>([doc]);
      for (const el of elements) {
        docs.add(el.ownerDocument);
        for (const frame of framesBetween(doc, el)) docs.add(frame.ownerDocument);
      }
      views = [...docs].map((d) => d.defaultView).filter((v) => v !== null);
      for (const view of views) {
        view.addEventListener('scroll', place, true);
        view.addEventListener('resize', place);
      }
    },
    dispose() {
      clear();
      style?.remove();
      style = null;
    },
  };
}
