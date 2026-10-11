import { deriveStyle, EMPTY_STYLE, type StyleContext } from './cascade';

/** The cascade as it stands on `el`, walked down from the root. */
export function styleAt(el: Element): StyleContext {
  const chain: Element[] = [];
  for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
  return chain.reduce<StyleContext>((style, e) => deriveStyle(style, e), EMPTY_STYLE);
}
