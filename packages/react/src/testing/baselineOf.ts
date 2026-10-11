/**
 * Where an element's first text sits, from a zero-height inline box set beside it. The box goes in a span wrapped
 * round the text: appended to a flex container it would be a flex item, off the line. Only a real browser lays
 * text out, so this is for `*.browser.test.*` files.
 */
export function baselineOf(el: Element): number {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, (n) =>
    n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  );
  const text = walker.nextNode();
  if (!text?.parentNode) throw new Error('baselineOf: the element holds no text');
  const wrap = document.createElement('span');
  const probe = document.createElement('span');
  probe.style.display = 'inline-block';
  text.parentNode.replaceChild(wrap, text);
  wrap.append(text, probe);
  const y = probe.getBoundingClientRect().bottom;
  wrap.replaceWith(text);
  return y;
}
