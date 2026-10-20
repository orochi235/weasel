/**
 * The stylesheet a document or a shadow root holds its themes' rules in, and
 * the count of what still uses each one.
 *
 * A rule lives where its elements do: a popout window's document and a shadow
 * root each get a sheet of their own, since a rule in the opener's document
 * styles nothing in either. A rule nobody holds any more leaves its sheet, so
 * a page that mints a theme per instance holds only the live ones.
 */

/** Where an element's styles come from. */
export type StyleRoot = Document | ShadowRoot;

const STYLE_ID = 'wzl-themes';

interface Variant {
  /** 0 is the definition that has the bare selector; a second, different
   *  definition held at once under the same name and selection gets its own. */
  id: number;
  body: string;
  holds: number;
}

interface RootSheet {
  /** `selector` → the definitions held under it. */
  rules: Map<string, Variant[]>;
  sheet: CSSStyleSheet | null;
  styleEl: HTMLStyleElement | null;
}

let sheets = new WeakMap<StyleRoot, RootSheet>();

/** Test seam: forgets every sheet, so each case starts clean. */
export function __resetThemeSheet(): void {
  sheets = new WeakMap();
}

/** The root `el`'s styles come from: its shadow root, else its document. */
export function styleRootOf(el: Element): StyleRoot {
  const root = el.getRootNode();
  return root instanceof (el.ownerDocument.defaultView?.ShadowRoot ?? ShadowRoot) ? (root as ShadowRoot) : el.ownerDocument;
}

const documentOf = (root: StyleRoot): Document => ('host' in root ? root.ownerDocument : root);

/** The selector suffix that keeps a variant's rule off the other definitions' elements, at no cost in specificity. */
const only = (id: number): string => (id === 0 ? '' : `:where([data-wzl-variant='${id}'])`);

function write(root: StyleRoot, held: RootSheet): void {
  const css = [...held.rules]
    .flatMap(([selector, variants]) =>
      // The bare rule first: it matches a variant's elements too, and the variant's has to win the tie.
      [...variants].sort((a, b) => a.id - b.id).map((v) => `${selector}${only(v.id)} { ${v.body} }`))
    .join('\n');
  // Not `@weasel-js/react`'s `adoptCss`: this entry loads without React.
  const win = documentOf(root).defaultView;
  const Sheet = win?.CSSStyleSheet;
  if (Sheet && 'replaceSync' in Sheet.prototype && Array.isArray(root.adoptedStyleSheets)) {
    if (!held.sheet) {
      // From the root's own window: a constructed sheet cannot be adopted across documents.
      held.sheet = new Sheet();
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, held.sheet];
    }
    held.sheet.replaceSync(css);
    return;
  }
  if (!held.styleEl) {
    held.styleEl = documentOf(root).createElement('style');
    held.styleEl.id = STYLE_ID;
    ('host' in root ? root : root.head).appendChild(held.styleEl);
  }
  held.styleEl.textContent = css;
}

/**
 * Hold the rule `selector { body }` in `root`'s sheet. Returns the variant id
 * the holder's element is to carry (0 for none) and the release, which takes
 * the rule out of the sheet once nothing else holds it.
 */
export function holdRule(root: StyleRoot, selector: string, body: string): { variant: number; release: () => void } {
  let held = sheets.get(root);
  if (!held) sheets.set(root, (held = { rules: new Map(), sheet: null, styleEl: null }));
  const variants = held.rules.get(selector) ?? [];
  let variant = variants.find((v) => v.body === body);
  if (variant) {
    variant.holds++;
  } else {
    let id = 0;
    while (variants.some((v) => v.id === id)) id++;
    variant = { id, body, holds: 1 };
    held.rules.set(selector, [...variants, variant]);
    write(root, held);
  }
  const mine = variant;
  const sheet = held;
  let released = false;
  return {
    variant: mine.id,
    release: () => {
      if (released) return;
      released = true;
      if (--mine.holds > 0) return;
      const left = (sheet.rules.get(selector) ?? []).filter((v) => v !== mine);
      if (left.length > 0) sheet.rules.set(selector, left);
      else sheet.rules.delete(selector);
      write(root, sheet);
    },
  };
}
