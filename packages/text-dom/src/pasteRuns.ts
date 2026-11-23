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

import { getOwn } from '@weasel-js/registry';
import { isBoldWeight, type StyledRun } from '@weasel-js/text';
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

/** How a text node's white space reaches the runs: collapsed, collapsed but for its line breaks, kept but for its
 *  line breaks, or kept whole. */
type SpaceMode = 'collapse' | 'breaks' | 'spaces' | 'keep';

const SPACE_MODES: Readonly<Record<string, SpaceMode>> = {
  normal: 'collapse', nowrap: 'collapse', collapse: 'collapse',
  'pre-line': 'breaks', 'preserve-breaks': 'breaks',
  'preserve-spaces': 'spaces',
  pre: 'keep', 'pre-wrap': 'keep', 'break-spaces': 'keep', preserve: 'keep',
};

/** How `el` treats its white space, given how its parent does. */
function spaceMode(el: HTMLElement, inherited: SpaceMode): SpaceMode {
  const collapse = el.style.getPropertyValue('white-space-collapse');
  const ws = (collapse || el.style.getPropertyValue('white-space')).trim().toLowerCase();
  if (ws === '') return el.tagName === 'PRE' ? 'keep' : inherited;
  for (const token of ws.split(/\s+/)) {
    const mode = getOwn(SPACE_MODES, token);
    if (mode !== undefined) return mode;
  }
  return inherited;
}

/** The run fields a paste keeps. Bold is read off the weight that renders: a run's own weight wins over its flag. */
function emphasis(text: string, style: StyleState): StyledRun {
  const read = toRun(text, style);
  const run: StyledRun = { text };
  if (read.fontWeight !== undefined ? isBoldWeight(read.fontWeight) : read.bold) run.bold = true;
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
  /** What has to precede the next text: a line break a block boundary asked for, a tab per cell boundary. */
  let gap = { line: false, tabs: 0 };
  /** Whether the current line has text on it, and whether that text ends in a collapsed space. */
  let onLine = false;
  let spaced = false;

  const write = (text: string, style: StyleState): void => {
    const lead = (gap.line && runs.length > 0 ? '\n' : '') + '\t'.repeat(gap.tabs);
    runs.push(emphasis(lead + text, style));
    gap = { line: false, tabs: 0 };
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
    gap = { line: gap.line || onLine, tabs: 0 };
    onLine = false;
  };

  const lineBreak = (style: StyleState): void => {
    trimSpace();
    write('\n', style);
    onLine = false;
  };
  const collapsed = (data: string, style: StyleState): void => {
    data.split(/[ \t\n\f]+/).forEach((word, i) => {
      // The space goes in with the text node that held it, as a browser draws it.
      // A cell's text opens after its tab, as a line's does after its start.
      if (i > 0 && onLine && !spaced && gap.tabs === 0) { write(' ', style); spaced = true; }
      if (word.length > 0) write(word, style);
    });
  };

  const visit = (node: Node, style: StyleState, mode: SpaceMode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = toLineFeeds((node as Text).data);
      if (mode === 'keep' || mode === 'spaces') {
        const text = mode === 'spaces' ? data.replace(/\n/g, ' ') : data;
        if (text.length > 0) write(text, style);
      } else if (mode === 'breaks') {
        data.split('\n').forEach((line, i) => {
          if (i > 0) lineBreak(style);
          collapsed(line, style);
        });
      } else collapsed(data, style);
      return;
    }
    if (!(node instanceof HTMLElement) || UNSEEN.has(node.tagName)) return;
    if (node.tagName === 'BR') {
      // Chrome ends a copied fragment with one that stands for no text.
      if (node.classList.contains('Apple-interchange-newline')) return;
      lineBreak(style);
      return;
    }
    const block = BLOCKS.has(node.tagName);
    if (block) boundary();
    if (CELLS.has(node.tagName) && node.previousElementSibling !== null) { trimSpace(); gap.tabs += 1; }
    const next = styleStateFromElement(node, style);
    const childMode = spaceMode(node, mode);
    for (const child of node.childNodes) visit(child, next, childMode);
    if (block) boundary();
  };
  visit(body, EMPTY_STYLE, 'collapse');
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
  const plain = toLineFeeds(data.getData('text/plain'));
  return plain.length > 0 ? [{ text: plain }] : [];
}

/** Pasted text with each CRLF or lone CR read as the LF a typed break is. */
function toLineFeeds(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}
