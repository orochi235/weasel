import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bidi } from '@weasel-js/bidi';
import { registerBidi, type OpenMenu } from '@weasel-js/core';
import type { MenuTextEntry } from '@weasel-js/menu';
import type { HudKeyEvent } from '../widget';
import { THEME_METRICS as m } from './menu.fixture';
import { createMenuWidget } from './menuWidget';
import { typedLine } from './typedLine';

const measure = (t: string) => Array.from(t).length * 7;
const keydown = (key: string): HudKeyEvent => ({
  type: 'keydown', key, code: key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null,
});

let unregister: () => void;
beforeEach(() => { unregister = registerBidi(bidi); });
afterEach(() => unregister());

function hebrewRow() {
  const row: MenuTextEntry = { kind: 'text', key: 'name', label: 'Name', value: '', set: vi.fn() };
  const open: OpenMenu = { seq: 1, source: 'pointer', client: { x: 100, y: 100 }, entries: [row] };
  const w = createMenuWidget({
    open, close: vi.fn(), toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }), measure, onChange: () => {},
  });
  const type = (keys: readonly string[]) => { for (const k of keys) w.onKey!(keydown(k)); };
  const click = (x: number, y: number) => {
    w.onPointer({ type: 'down', x, y, native: null });
    w.onPointer({ type: 'up', x, y, native: null });
  };
  return { row, w, type, click };
}

describe('a HUD text row typed into in Hebrew', () => {
  it('puts the caret at the line\'s left end, and a click on a character\'s left half after it', () => {
    const { row, w, type, click } = hebrewRow();
    type(['ArrowDown', 'Enter', 'ש', 'ל', 'ו', 'ם']);
    const p = w.bounds;
    const right = p.x + p.w - m.padX - 3;
    const left = right - 4 * 7;
    expect(w.textInput!.read()!.rect.x).toBe(left + 1);

    // Right to left, the second character (ל) is the second cell from the right: [right - 14, right - 7].
    click(right - 14 + 2, p.y + m.padY + m.rowHeight / 2);
    type(['X', 'Enter']);
    expect(row.set).toHaveBeenCalledExactlyOnceWith('שלXום');
  });
});

describe('typedLine', () => {
  it('splits a selection that crosses a change of direction into one span per stretch', () => {
    // "ab" then "שם": the Hebrew stretch reads right to left after the Latin one.
    const line = typedLine('abשם', 100, measure);
    expect(line.left).toBe(72);
    expect(line.xAt(2)).toBe(86);
    expect(line.xAt(3)).toBe(93);
    expect(line.spans(1, 3)).toEqual([[79, 86], [93, 100]]);
  });

  it('places offsets left to right with no engine registered', () => {
    unregister();
    const line = typedLine('abc', 100, measure);
    expect([0, 1, 2, 3].map((i) => line.xAt(i))).toEqual([79, 86, 93, 100]);
  });
});
