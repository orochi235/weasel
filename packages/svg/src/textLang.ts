/** A text's language, which SVG states with `xml:lang` (SVG 1.1) or `lang` (SVG 2). */

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/** The language `el` states itself, `xml:lang` before `lang`; null when it states none. */
export function ownLang(el: Element): string | null {
  return el.getAttributeNS(XML_NS, 'lang') ?? el.getAttribute('xml:lang') ?? el.getAttribute('lang');
}

/** The language in effect at `el`: its own, else the nearest ancestor's. An
 *  empty value states that the language is unknown, and reads as none. */
export function inheritedLang(el: Element): string | undefined {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const v = ownLang(e);
    if (v !== null) return v.trim() || undefined;
  }
  return undefined;
}
