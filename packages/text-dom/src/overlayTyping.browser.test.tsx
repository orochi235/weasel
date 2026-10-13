/**
 * Typing into the edit overlay in a real browser: the browser inserts a typed
 * character itself, so the keystroke is followed by an `input` event and sits
 * on the native undo stack, and the hook steps in only where the character
 * must open a run of its own.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import type { TextEditCommit, TextEditScreenPose, UseTextEditReturn } from './textEditTypes';
import { overlayReady } from './testing/overlayReady';

const BOX = { x: 20, y: 20, width: 120, height: 200 };
const FONT_SIZE = 20;

interface Case {
  text: string;
  runs?: StyledRun[];
  caret: number | 'all';
  style?: TextStyle;
  pose?: Partial<TextEditScreenPose>;
}

let host: HTMLDivElement;
let root: Root;
let edit: UseTextEditReturn;
let commits: TextEditCommit[] = [];
let mounted = 0;

function Editor({ c }: { c: Case }) {
  edit = useTextEdit({
    container: host,
    getText: () => c.text,
    getRuns: () => c.runs,
    getStyle: () => ({ fontFamily: 'Arial', fontSize: FONT_SIZE, lineHeight: 1.2, caretColor: 'transparent', ...c.style }),
    getScreenPose: (): TextEditScreenPose => ({ ...BOX, fontSize: FONT_SIZE, zoom: 1, ...c.pose }),
    commit: (_id, e) => { commits.push(e); },
  });
  const { startEdit } = edit;
  useEffect(() => { startEdit('n', { caret: c.caret }); }, [startEdit, c.caret]);
  return null;
}

async function open(c: Case): Promise<HTMLElement> {
  commits = [];
  flushSync(() => root.render(createElement(Editor, { key: ++mounted, c })));
  return overlayReady(host);
}

function committed(): TextEditCommit {
  flushSync(() => edit.commit());
  expect(commits).toHaveLength(1);
  return commits[0];
}

beforeAll(() => {
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '400px', height: '460px' });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));
  registerCanvasFont('Arial');
});

afterAll(() => {
  root.unmount();
  host.remove();
});

describe('typing into the edit overlay', () => {
  it('follows a typed character with an input event, by which the overlay is already re-placed', async () => {
    // Centered and wrapping, one word short of a second line.
    const overlay = await open({
      text: 'word word', caret: 9, style: { wrap: true }, pose: { verticalAlign: 'center' },
    });
    const before = overlay.offsetHeight;
    const seen: Array<{ type: string; top: string; height: number }> = [];
    overlay.addEventListener('input', (e) => {
      seen.push({ type: (e as InputEvent).inputType, top: overlay.style.top, height: overlay.offsetHeight });
    });
    await userEvent.keyboard(' word');
    const last = seen[seen.length - 1];
    expect(seen.map((s) => s.type)).toEqual(Array(5).fill('insertText'));
    expect(last.height).toBe(before * 2);
    expect(parseFloat(last.top)).toBeCloseTo(BOX.y + (BOX.height - last.height) / 2, 0);
    expect(committed().text).toBe('word word word');
  });

  it('puts a typed character on the native undo stack', async () => {
    await open({ text: 'abc', caret: 3 });
    await userEvent.keyboard('d');
    document.execCommand('undo');
    await userEvent.keyboard('e');
    expect(committed().text).toBe('abce');
  });

  it('types into the run that holds the caret', async () => {
    await open({ text: 'ab', runs: [{ text: 'a', bold: true }, { text: 'b' }], caret: 1 });
    await userEvent.keyboard('X');
    expect(committed().runs).toEqual([{ text: 'aX', bold: true }, { text: 'b' }]);
  });

  it('replaces a whole selection with the typed text', async () => {
    await open({ text: 'abc', caret: 'all' });
    await userEvent.keyboard('xy');
    expect(committed().text).toBe('xy');
  });

  it('gives an armed style to the next character alone', async () => {
    await open({ text: 'abc', runs: [{ text: 'abc' }], caret: 3 });
    await userEvent.keyboard('{Control>}b{/Control}XYZ');
    expect(committed().runs).toEqual([{ text: 'abc' }, { text: 'X', bold: true }, { text: 'YZ' }]);
  });

  it('types into an empty overlay', async () => {
    await open({ text: '', caret: 0 });
    await userEvent.keyboard('hi');
    expect(committed().text).toBe('hi');
  });
});

/** Copy `source`'s contents with the browser's own copy, then paste at the overlay's caret. */
async function copyThenPaste(source: HTMLElement, overlay: HTMLElement): Promise<void> {
  const at = document.getSelection()!.getRangeAt(0).cloneRange();
  document.getSelection()!.selectAllChildren(source);
  await userEvent.copy();
  overlay.focus();
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(at);
  await userEvent.paste();
}

describe('pasting into the edit overlay', () => {
  const PAGE =
    '<p style="color: red; font-family: Georgia; font-size: 30px">Hello <b>bold</b> and <i>it</i></p>\n'
    + '<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>'
    + '<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>';

  it('reads a page\'s markup as runs: its blocks as lines, its emphasis kept, its face and color left behind', async () => {
    const source = document.createElement('div');
    source.innerHTML = PAGE;
    document.body.appendChild(source);
    const overlay = await open({ text: 'xy', runs: [{ text: 'xy', fontSize: 12 }], caret: 1 });
    await copyThenPaste(source, overlay);
    source.remove();
    expect(overlay.querySelector('ul, table, p, b, i')).toBeNull();
    expect([...overlay.children].every((el) => el.matches('span[data-run]'))).toBe(true);
    const edit = committed();
    expect(edit.text).toBe('xHello bold and it\none\ntwo\na\tb\nc\tdy');
    expect(edit.runs).toEqual([
      { text: 'xHello ', fontSize: 12 },
      { text: 'bold', fontSize: 12, bold: true },
      { text: ' and ', fontSize: 12 },
      { text: 'it', fontSize: 12, italic: true },
      { text: '\none\ntwo\na\tb\nc\tdy', fontSize: 12 },
    ]);
  });

  it('pastes the overlay\'s own runs back with their emphasis, over the selection', async () => {
    const source = document.createElement('div');
    source.style.whiteSpace = 'pre';
    document.body.appendChild(source);
    const { runsToDom } = await import('./domRuns');
    runsToDom([{ text: 'plain ' }, { text: 'bold\nline', bold: true }], source);
    const overlay = await open({ text: 'abc', caret: 'all' });
    await copyThenPaste(source, overlay);
    source.remove();
    const edit = committed();
    expect(edit.text).toBe('plain bold\nline');
    expect(edit.runs).toEqual([{ text: 'plain ' }, { text: 'bold\nline', bold: true }]);
  });

  it('leaves the caret after the pasted text', async () => {
    const source = document.createElement('div');
    source.textContent = 'PQ';
    document.body.appendChild(source);
    const overlay = await open({ text: 'ab', caret: 1 });
    await copyThenPaste(source, overlay);
    source.remove();
    await userEvent.keyboard('!');
    expect(committed().text).toBe('aPQ!b');
  });
});
