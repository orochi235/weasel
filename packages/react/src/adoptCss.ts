/** Where an element's styles come from. */
export type StyleRoot = Document | ShadowRoot;

/** The root `el`'s styles come from: its shadow root, else its document. */
export function styleRootOf(el: Element): StyleRoot {
  const root = el.getRootNode();
  return root instanceof (el.ownerDocument.defaultView?.ShadowRoot ?? ShadowRoot) ? (root as ShadowRoot) : el.ownerDocument;
}

/** A sheet {@link adoptCss} put in a root. */
export interface AdoptedCss {
  /** Replace the sheet's text. */
  write: (css: string) => void;
  /** Take the sheet out of its root. */
  release: () => void;
}

/**
 * A sheet of its own in `root`, holding `css`: an adopted constructed sheet
 * where the root takes one, else a `<style>`, with `styleId` as its id when
 * one is passed.
 */
export function adoptCss(root: StyleRoot, css: string, styleId?: string): AdoptedCss {
  const doc = 'host' in root ? root.ownerDocument : root;
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && 'replaceSync' in Sheet.prototype && Array.isArray(root.adoptedStyleSheets)) {
    // From the root's own window: a constructed sheet cannot be adopted across documents.
    const sheet = new Sheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return {
      write: (next) => sheet.replaceSync(next),
      release: () => {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
      },
    };
  }
  const style = doc.createElement('style');
  if (styleId !== undefined) style.id = styleId;
  style.textContent = css;
  ('host' in root ? root : doc.head).appendChild(style);
  return {
    write: (next) => {
      style.textContent = next;
    },
    release: () => style.remove(),
  };
}

let held = new WeakMap<StyleRoot, Set<string>>();

/**
 * Hold `css` in the root `el`'s styles come from, once per root however many
 * elements ask, and never take it back out: for a component's fixed rules.
 */
export function adoptCssOnce(el: Element, css: string): void {
  const root = styleRootOf(el);
  let rules = held.get(root);
  if (rules === undefined) held.set(root, (rules = new Set()));
  if (rules.has(css)) return;
  rules.add(css);
  adoptCss(root, css);
}

/** Test seam: forgets which roots hold which rules. */
export function __resetAdoptedCss(): void {
  held = new WeakMap();
}
