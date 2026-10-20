/** Outlines over the elements an axe finding names, drawn in the document that holds them. */
export interface A11yHighlighter {
  /** Outlines every element `targets` reaches, replacing what was shown; an empty list clears. */
  show(targets: readonly (readonly string[])[]): void;
  dispose(): void;
}

const CSS = `[data-fg-a11y-highlight] {
  position: fixed;
  z-index: 2147483647;
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

export function createA11yHighlighter(doc: Document): A11yHighlighter {
  let style: HTMLStyleElement | null = null;
  let boxes: { el: Element; box: HTMLElement }[] = [];
  const view = doc.defaultView;

  const place = () => {
    for (const { el, box } of boxes) {
      const rect = el.getBoundingClientRect();
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    }
  };

  const clear = () => {
    for (const { box } of boxes) box.remove();
    boxes = [];
    view?.removeEventListener('scroll', place, true);
    view?.removeEventListener('resize', place);
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
      view?.addEventListener('scroll', place, true);
      view?.addEventListener('resize', place);
    },
    dispose() {
      clear();
      style?.remove();
      style = null;
    },
  };
}
