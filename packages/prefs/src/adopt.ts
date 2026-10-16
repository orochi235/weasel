/** Where an element's styles come from. */
export type PrefsStyleRoot = Document | ShadowRoot;

/** The root `el`'s styles come from: its shadow root, else its document. */
export function prefsStyleRootOf(el: Element): PrefsStyleRoot {
  const root = el.getRootNode();
  return root instanceof (el.ownerDocument.defaultView?.ShadowRoot ?? ShadowRoot) ? (root as ShadowRoot) : el.ownerDocument;
}

/**
 * A sheet of its own in `root`, holding `css`: an adopted constructed sheet
 * where the root takes one, else a `<style>`. `write` replaces the text and
 * `release` takes the sheet out.
 */
export function adoptPrefsCss(root: PrefsStyleRoot, css: string): { write: (css: string) => void; release: () => void } {
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
  style.textContent = css;
  ('host' in root ? root : doc.head).appendChild(style);
  return {
    write: (next) => {
      style.textContent = next;
    },
    release: () => style.remove(),
  };
}
