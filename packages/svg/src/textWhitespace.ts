/** SVG's whitespace handling for `<text>` content. */

import type { StyledRun } from '@weasel-js/core';

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/**
 * Does `xml:space="preserve"` apply to this element? The attribute inherits,
 * so an ancestor can set it.
 *
 * weasel's own `<text>` output carries it, because the runs model stores real
 * line breaks and SVG's default whitespace handling would collapse them away.
 */
export function preservesSpace(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const v = e.getAttributeNS(XML_NS, 'space') ?? e.getAttribute('xml:space');
    if (v === 'preserve') return true;
    if (v === 'default') return false;
  }
  return false;
}

/**
 * Apply SVG's default whitespace handling to a `<text>` element's runs, in
 * place: newlines dropped, tabs folded to spaces, runs of spaces collapsed to
 * one, and leading / trailing space stripped across the element as a whole.
 *
 * Without this, importing any pretty-printed SVG drags the source file's
 * indentation into the document text — and, because the height estimate
 * counts newlines, reports a one-line label as four lines tall.
 */
export function collapseRunWhitespace(runs: StyledRun[]): void {
  let atStart = true;
  let lastWasSpace = false;
  for (const run of runs) {
    let out = '';
    for (const ch of run.text.replace(/\n/g, '').replace(/[\t\r]/g, ' ')) {
      if (ch === ' ') {
        if (atStart || lastWasSpace) continue;
        out += ' ';
        lastWasSpace = true;
        continue;
      }
      out += ch;
      lastWasSpace = false;
      atStart = false;
    }
    run.text = out;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].text === '') continue;
    if (runs[i].text.endsWith(' ')) runs[i].text = runs[i].text.slice(0, -1);
    break;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].text === '') runs.splice(i, 1);
  }
}
