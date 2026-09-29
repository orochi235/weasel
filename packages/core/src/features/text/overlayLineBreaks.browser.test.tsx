/**
 * The edit overlay against the canvas layout it stands in for: under
 * `TextStyle.wrap`, every character must land on the same line in both, or
 * the paragraph reflows the moment an edit opens. The overlay's line breaks
 * are the browser's own, so this is `layoutRuns`' UAX #14 breaking checked
 * against a real implementation — after a hyphen and between ideographs, where
 * breaking only at spaces disagreed. Hard breaks are the other way round: the
 * browser breaks at LF alone, so the overlay has to stand one in for the rest.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerFont, registerFontOutlines, registerCanvasFont } from '@weasel-js/font';
import { layoutTextPose, type TextStyle } from '@weasel-js/text';
import { useTextEdit, type TextEditScreenPose } from './useTextEdit';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../../assets/fonts/inter/inter.ttf?url';

const BOX = { x: 20, y: 20, width: 200, height: 400 };

interface Case {
  name: string; family: string; fontSize: number; text: string;
  /** Seed the overlay from runs rather than plain text. */
  runs?: boolean;
}

const styleOf = (c: Case): TextStyle => ({ fontFamily: c.family, fontSize: c.fontSize, lineHeight: 1.2, wrap: true });

/** The line each UTF-16 offset of the text sits on, as the canvas lays it out. */
function canvasLines(c: Case): number[] {
  const { laid } = layoutTextPose({ ...BOX, text: c.text, style: styleOf(c) });
  const at = new Array<number>(c.text.length).fill(-1);
  laid.lines.forEach((line, n) => {
    for (const cell of line.cells) for (let i = cell.srcIndex; i < cell.srcEnd; i++) at[i] = n;
  });
  return at;
}

/** The same, read off the overlay's text with a range per character. */
function overlayLines(overlay: HTMLElement): number[] {
  const tops: number[] = [];
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    for (let i = 0; i < len; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      tops.push(range.getClientRects()[0]?.top ?? Number.NaN);
    }
  }
  const rows = [...new Set(tops.map(Math.round))].sort((a, b) => a - b);
  return tops.map((t) => rows.indexOf(Math.round(t)));
}

let host: HTMLDivElement;
let root: Root;

let committed: string[] = [];
let commitEdit: () => void = () => {};

function Editor({ c, caret }: { c: Case; caret: number }) {
  const { startEdit, commit } = useTextEdit({
    container: host,
    getText: () => c.text,
    ...(c.runs ? { getRuns: () => [{ text: c.text }], setRuns: () => {} } : {}),
    getStyle: () => ({ ...styleOf(c), caretColor: 'transparent' }),
    getScreenPose: (): TextEditScreenPose => ({ ...BOX, fontSize: c.fontSize, zoom: 1 }),
    setText: (_id, text) => { committed.push(text); },
  });
  commitEdit = commit;
  useEffect(() => { startEdit('n', { caret }); }, [startEdit, caret]);
  return null;
}

async function openOverlay(c: Case, caret = 0): Promise<HTMLElement> {
  flushSync(() => root.render(createElement(Editor, { key: `${c.name}@${caret}`, c, caret })));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await frames();
  const overlay = host.querySelector<HTMLElement>('[contenteditable]')!;
  // `fonts.ready` alone can resolve before the first overlay has asked for
  // its face, and the first case then measures the fallback.
  await document.fonts.load(getComputedStyle(overlay).font, c.text);
  await document.fonts.ready;
  await frames();
  return overlay;
}

beforeAll(async () => {
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '400px', height: '460px' });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));
  await registerFont('Inter', {}, metricsUrl, atlasUrl);
  registerFontOutlines('Inter', {}, ttfUrl);
  registerCanvasFont('Arial');
});

afterAll(() => {
  root.unmount();
  host.remove();
});

/** Every UAX #14 hard break, CRLF among them, between words that fit the box. */
const HARD = 'one\u2028two\u2029three\rfour\r\nfive\u000bsix\u000cseven\u0085eight\nnine';

describe('edit overlay line breaks', () => {
  const CASES: Case[] = [
    { name: 'hyphenated Latin', family: 'Inter', fontSize: 24, text: 'Hxgd-Hxgd-Hxgd-Hxgd-Hxgd-Hxgd' },
    { name: 'hyphens between spaced words', family: 'Inter', fontSize: 20, text: 'a well-known, hand-made, state-of-the-art text' },
    { name: 'CJK', family: 'Arial', fontSize: 24, text: '漢字仮名交じり文は、漢字と仮名で書く日本語の文章です。' },
    { name: 'hard breaks', family: 'Inter', fontSize: 20, text: HARD },
    { name: 'hard breaks, from runs', family: 'Inter', fontSize: 20, text: HARD, runs: true },
  ];

  for (const c of CASES) {
    it(`breaks ${c.name} where the canvas does`, async () => {
      const canvas = canvasLines(c);
      const overlay = overlayLines(await openOverlay(c));
      expect(Math.max(...canvas), 'the canvas wraps at all').toBeGreaterThan(0);
      // A hard break lays out no cell on the canvas, so only characters it
      // places are compared.
      const show = (lines: number[]) => lines.map((n, i) => (canvas[i] < 0 ? '' : `${n}${c.text[i]}`)).join(' ');
      expect(show(overlay)).toBe(show(canvas));
    });
  }

  for (const runs of [false, true]) {
    const c: Case = { name: `caret${runs ? ', from runs' : ''}`, family: 'Inter', fontSize: 20, text: HARD, runs };

    it(`puts the caret on the source offset past each hard break${runs ? ', seeded from runs' : ''}`, async () => {
      for (const word of ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']) {
        const at = c.text.indexOf(word);
        const overlay = await openOverlay(c, at);
        const sel = document.getSelection()!;
        const rest = document.createRange();
        rest.setStart(sel.anchorNode!, sel.anchorOffset);
        rest.setEndAfter(overlay.lastChild!);
        expect(rest.toString().startsWith(word), `caret at ${at}`).toBe(true);
      }
    });

    it(`commits every hard break unchanged${runs ? ', seeded from runs' : ''}`, async () => {
      committed = [];
      await openOverlay(c);
      flushSync(() => commitEdit());
      expect(committed.map((t) => JSON.stringify(t))).toEqual([JSON.stringify(c.text)]);
    });
  }
});
