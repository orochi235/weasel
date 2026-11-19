/**
 * What a mounted tree can leave on the document after it unmounts, as a value to compare before and after: the
 * nodes directly under `<body>` and `<head>`, the attributes on `<html>` and `<body>`, and every element hidden
 * from assistive tech or made inert (a modal's `aria-hidden` on its siblings, left behind, hides the page).
 */
export function domResidue(): Record<string, string[]> {
  const attrs = (el: Element) => [...el.attributes].map((a) => `${a.name}=${a.value}`).sort();
  const tags = (el: Element) => [...el.children].map((c) => `<${c.tagName.toLowerCase()}${c.id ? `#${c.id}` : ''}>`);
  return {
    body: tags(document.body),
    head: tags(document.head),
    htmlAttrs: attrs(document.documentElement),
    bodyAttrs: attrs(document.body),
    hidden: [...document.querySelectorAll('[aria-hidden], [inert], [data-react-aria-top-layer]')]
      .filter((el) => !el.closest('svg') || el.tagName === 'svg')
      .map((el) => `<${el.tagName.toLowerCase()}> ${attrs(el).join(' ')}`),
  };
}
