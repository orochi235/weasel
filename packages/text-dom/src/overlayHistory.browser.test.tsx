/**
 * Undo inside the edit overlay with real keys in a real browser, where Chromium clears its own undo stack as soon
 * as a script writes the overlay: the overlay's own history answers Mod+Z instead.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import { useTextEdit } from '@weasel-js/text-dom';
import type { TextEditCommit, TextEditScreenPose, UseTextEditReturn } from './textEditTypes';
import { overlayReady } from '@weasel-js/text-dom/testing/overlayReady';

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
  flushSync(() => edit.commitEdit());
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

const UNDO = '{Meta>}z{/Meta}';
const REDO = '{Meta>}{Shift>}z{/Shift}{/Meta}';

describe('undo inside the edit overlay', () => {
  it('takes back a restyle, then what was typed before it', async () => {
    const overlay = await open({ text: 'abc', caret: 3 });
    await userEvent.keyboard('d');
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}{Meta>}b{/Meta}');
    expect(overlay.querySelector('span[style*="700"]')?.textContent).toBe('cd');
    await userEvent.keyboard(UNDO);
    expect(overlay.querySelector('span[style*="700"]')).toBeNull();
    expect(window.getSelection()!.toString()).toBe('cd');
    await userEvent.keyboard(UNDO);
    expect(overlay.textContent).toBe('abc');
    flushSync(() => edit.commitEdit());
    expect(commits).toEqual([]);
  });

  it('redoes what it undid', async () => {
    await open({ text: 'abc', caret: 3 });
    await userEvent.keyboard('{Meta>}b{/Meta}XY');
    await userEvent.keyboard(UNDO);
    await userEvent.keyboard(REDO);
    expect(committed().runs).toEqual([{ text: 'abc' }, { text: 'XY', bold: true }]);
  });
});
