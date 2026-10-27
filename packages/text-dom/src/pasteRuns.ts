/**
 * Clipboard contents as runs. Pasted markup never reaches the overlay's DOM:
 * it is parsed apart from the page and read here, so whatever an application
 * put on the clipboard arrives as text with line breaks, tabs, and emphasis.
 *
 * Emphasis is all that is kept of its styling: bold, italic, the three rules,
 * and super- and subscript. A browser writes every copied element's computed
 * face, size, and color into the markup, the source page's defaults among
 * them, so those cannot be told from styling someone chose, and the pasted
 * text takes them from where it lands.
 */

import type { StyledRun } from '@weasel-js/text';
import { EMPTY_STYLE, styleStateFromElement, toRun, type StyleState } from './runStyle';

/** Elements whose contents are not text a reader sees. */
const UNSEEN: ReadonlySet<string> = new Set([
  'HEAD', 'IFRAME', 'NOSCRIPT', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE', 'TITLE',
]);

/** Elements that start and end on a line of their own. */
const BLOCKS: ReadonlySet<string> = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN',
  'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TR', 'UL',
]);

const CELLS: ReadonlySet<string> = new Set(['TD', 'TH']);

/** Whether `el` keeps its white space, given whether its parent does. */
function keepsSpace(el: HTMLElement, inherited: boolean): boolean {
  const collapse = el.style.getPropertyValue('white-space-collapse');
  const ws = collapse || el.style.getPropertyValue('white-space');
  if (ws === '') return el.tagName === 'PRE' || inherited;
  return /^(pre|pre-wrap|break-spaces|preserve)\b/.test(ws);
}

/** The run fields a paste keeps. A weight of 600 or more reads as bold. */
function emphasis(text: string, style: StyleState): StyledRun {
  const read = toRun(text, style);
  const run: StyledRun = { text };
  if (read.bold || (read.fontWeight ?? 0) >= 600) run.bold = true;
  for (const key of ['italic', 'underline', 'strikethrough', 'overline'] as const) if (read[key]) run[key] = true;
  if (read.script) run.script = read.script;
  return run;
}

/**
 * The text of `html` as runs. A block opens and closes a line, a table cell
 * follows the one before it after a tab, and white space collapses as a
 * browser collapses it unless the markup says to keep it.
 */
export function htmlToRuns(html: string): StyledRun[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const runs: StyledRun[] = [];
  /** What has to precede the next text: a line break a block boundary asked for, a tab between cells. */
  let gap = { line: false, tab: false };
  /** Whether the current line has text on it, and whether that text ends in a collapsed space. */
  let onLine = false;
  let spaced = false;

  const write = (text: string, style: StyleState): void => {
    const lead = (gap.line && runs.length > 0 ? '\n' : '') + (gap.tab ? '\t' : '');
    runs.push(emphasis(lead + text, style));
    gap = { line: false, tab: false };
    onLine = true;
    spaced = false;
  };
  /** A collapsed space that turned out to end its line draws nothing. */
  const trimSpace = (): void => {
    const last = runs[runs.length - 1];
    if (spaced && last) last.text = last.text.slice(0, -1);
    spaced = false;
  };
  const boundary = (): void => {
    trimSpace();
    gap = { line: gap.line || onLine, tab: false };
    onLine = false;
  };

  const visit = (node: Node, style: StyleState, keep: boolean): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data.replace(/\r\n?/g, '\n');
      if (keep) { if (data.length > 0) write(data, style); return; }
      data.split(/[ \t\n\f]+/).forEach((word, i) => {
        // The space goes in with the text node that held it, as a browser draws it.
        if (i > 0 && onLine && !spaced) { write(' ', style); spaced = true; }
        if (word.length > 0) write(word, style);
      });
      return;
    }
    if (!(node instanceof HTMLElement) || UNSEEN.has(node.tagName)) return;
    if (node.tagName === 'BR') {
      // Chrome ends a copied fragment with one that stands for no text.
      if (node.classList.contains('Apple-interchange-newline')) return;
      trimSpace();
      write('\n', style);
      onLine = false;
      return;
    }
    const block = BLOCKS.has(node.tagName);
    if (block) boundary();
    if (CELLS.has(node.tagName) && node.previousElementSibling !== null) { trimSpace(); gap.tab = true; }
    const next = styleStateFromElement(node, style);
    const keeps = keepsSpace(node, keep);
    for (const child of node.childNodes) visit(child, next, keeps);
    if (block) boundary();
  };
  visit(body, EMPTY_STYLE, false);
  trimSpace();

  // Neighbors alike in what was kept, which differed only in what was not.
  const kept = (run: StyledRun): string => JSON.stringify({ ...run, text: '' });
  const merged: StyledRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (run.text.length === 0) continue;
    if (last && kept(last) === kept(run)) last.text += run.text;
    else merged.push(run);
  }
  return merged;
}

/**
 * What a paste or a drop carries, as runs: its markup where it has any that
 * holds text, otherwise its plain text.
 */
export function clipboardRuns(data: DataTransfer): StyledRun[] {
  const html = data.getData('text/html');
  const fromHtml = html ? htmlToRuns(html) : [];
  if (fromHtml.length > 0) return fromHtml;
  const plain = data.getData('text/plain').replace(/\r\n/g, '\n');
  return plain.length > 0 ? [{ text: plain }] : [];
}
