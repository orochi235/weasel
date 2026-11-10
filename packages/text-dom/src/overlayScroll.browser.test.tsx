/**
 * A node that clips its text, edited in a real browser: the text scrolls in
 * the node's box, under the wheel and after the caret, and the box itself, the
 * paper the canvas paints, never moves.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from '@weasel-js/text-dom';
import type { TextEditScreenPose, UseTextEditReturn } from './textEditTypes';
import { overlayReady } from '@weasel-js/text-dom/testing/overlayReady';

const INSET = 10;
/** A 150 × 150 note at (40, 40); its text box is 130 × 130. */
const NOTE = { x: 40, y: 40, width: 150, height: 150 };
const LONG = Array.from({ length: 30 }, (_, i) => `line ${i + 1} of the note`).join(' ');

let host: HTMLDivElement;
let root: Root;
let edit: UseTextEditReturn;
let mounted = 0;

function Editor({ text, caret, pose, style }: {
  text: string; caret: number | 'all'; pose?: Partial<TextEditScreenPose>; style?: TextStyle;
}) {
  edit = useTextEdit({
    container: host,
    getText: () => text,
    getStyle: () => ({ fontFamily: 'Arial', fontSize: 16, lineHeight: 1.25, wrap: true, ...style }),
    getScreenPose: (): TextEditScreenPose => {
      const zoom = pose?.zoom ?? 1;
      return {
        x: NOTE.x + INSET * zoom, y: NOTE.y + INSET * zoom,
        width: NOTE.width - 2 * INSET, height: NOTE.height - 2 * INSET,
        fontSize: 16, zoom, clip: { top: INSET, right: INSET, bottom: INSET, left: INSET }, ...pose,
      };
    },
    commit: () => {},
  });
  const { startEdit } = edit;
  useEffect(() => { startEdit('n', { caret }); }, [startEdit, caret]);
  return null;
}

async function open(props: Parameters<typeof Editor>[0]): Promise<{ overlay: HTMLElement; box: HTMLElement }> {
  flushSync(() => root.render(createElement(Editor, { key: ++mounted, ...props })));
  const overlay = await overlayReady(host);
  return { overlay, box: overlay.parentElement! };
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
const rectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
function caretRect(): DOMRect {
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(sel.focusNode!, sel.focusOffset);
  return range.getBoundingClientRect();
}
/** Whether the overlay is what a press at `(x, y)` lands on. */
function overlayAt(overlay: HTMLElement, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  return hit !== null && (hit === overlay || overlay.contains(hit));
}

beforeAll(() => {
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '400px', height: '400px' });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));
  registerCanvasFont('Arial');
});

afterAll(() => {
  root.unmount();
  host.remove();
});

describe('editing a clipped node whose text overflows', () => {
  it('scrolls the text, not the box, under the wheel, and shows nothing past the box', async () => {
    const { overlay, box } = await open({ text: LONG, caret: 0 });
    expect(rectOf(box)).toEqual({ left: 40, top: 40, width: 150, height: 150 });
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight * 2);
    expect(box.scrollTop).toBe(0);
    // Text runs on below the box, but a press there misses it.
    expect(overlayAt(overlay, 100, 180)).toBe(true);
    expect(overlayAt(overlay, 100, 200)).toBe(false);

    await userEvent.wheel(box, { delta: { y: 120 } });
    await expect.poll(() => box.scrollTop).toBeGreaterThan(0);
    expect(rectOf(box)).toEqual({ left: 40, top: 40, width: 150, height: 150 });
    // Scrolled text is cut at the top edge too.
    expect(overlayAt(overlay, 100, 35)).toBe(false);
  });

  it('brings the caret into the box as the arrow keys move it past the bottom', async () => {
    const { box } = await open({ text: LONG, caret: 0 });
    for (let i = 0; i < 14; i++) await userEvent.keyboard('{ArrowDown}');
    await frame();
    expect(box.scrollTop).toBeGreaterThan(0);
    const c = caretRect();
    const b = box.getBoundingClientRect();
    expect(c.top).toBeGreaterThanOrEqual(b.top);
    expect(c.bottom).toBeLessThanOrEqual(b.bottom);
    expect(rectOf(box)).toEqual({ left: 40, top: 40, width: 150, height: 150 });
  });

  it('keeps the caret in view while typing at the end of the text', async () => {
    const { box } = await open({ text: 'short', caret: 5 });
    await userEvent.keyboard(' and then a good deal more text, enough to run past the bottom of a small note');
    await frame();
    expect(box.scrollTop).toBeGreaterThan(0);
    const c = caretRect();
    const b = box.getBoundingClientRect();
    expect(c.bottom).toBeLessThanOrEqual(b.bottom);
  });

  it('scrolls back to the top when the caret goes there', async () => {
    const { box } = await open({ text: LONG, caret: 0 });
    box.scrollTop = box.scrollHeight;
    await frame();
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
    await frame();
    // The caret's rect is the face's height, not quite the line's.
    expect(box.scrollTop).toBeLessThan(3);
  });

  it('opens a bottom-aligned note on its last line, as the canvas shows it', async () => {
    const { box } = await open({ text: LONG, caret: 0, pose: { verticalAlign: 'bottom' } });
    await frame();
    expect(box.scrollTop).toBeCloseTo(box.scrollHeight - box.clientHeight, 0);
  });

  it('scales the box with the view and still scrolls the caret into it', async () => {
    const { box } = await open({ text: LONG, caret: 0, pose: { zoom: 1.5 } });
    const before = rectOf(box);
    expect(before.width).toBeCloseTo(225, 0);
    for (let i = 0; i < 12; i++) await userEvent.keyboard('{ArrowDown}');
    await frame();
    expect(box.scrollTop).toBeGreaterThan(0);
    const c = caretRect();
    const b = box.getBoundingClientRect();
    expect(c.bottom).toBeLessThanOrEqual(b.bottom);
    expect(rectOf(box)).toEqual(before);
  });
});
