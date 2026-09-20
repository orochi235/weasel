import type { CapturedPicture } from '../protocol/messages';
import { scanCssVars } from './cssVars';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Every rule the document can read. A cross-origin sheet refuses, and is skipped. */
function documentCss(doc: Document): string {
  const out: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out.push(rule.cssText);
    } catch {
      // A cross-origin sheet refuses to be read.
    }
  }
  return out.join('\n');
}

/**
 * The story's own subtree as an SVG picture: the DOM inside a `<foreignObject>`, with the document's
 * stylesheets beside it.
 *
 * The capture root is a `<div>`, so nothing a rule hangs off `:root`, `html` or `body` reaches the story —
 * hence the custom properties restated on the root, which is what theme tokens travel by.
 */
export function captureElement(element: HTMLElement): Extract<CapturedPicture, { kind: 'svg' }> {
  const doc = element.ownerDocument;
  const rect = element.getBoundingClientRect();
  const w = Math.max(1, Math.ceil(rect.width));
  const h = Math.max(1, Math.ceil(rect.height));

  const root = doc.createElement('div');
  root.setAttribute('data-fg-capture', '');
  const tokens = scanCssVars(doc)
    .filter((v) => v.value)
    .map((v) => `${v.name}: ${v.value};`)
    .join('');
  const style = doc.createElement('style');
  style.textContent = `${documentCss(doc)}\n[data-fg-capture]{${tokens}}`;
  root.append(style, element.cloneNode(true));

  // XML, not HTML: an `<svg>` base is re-parsed as XML, where `<br>` and friends have to be closed.
  const inner = new XMLSerializer().serializeToString(root);
  return {
    kind: 'svg',
    markup: `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${inner}</foreignObject></svg>`,
  };
}
