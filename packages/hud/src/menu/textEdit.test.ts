import { describe, expect, it, vi } from 'vitest';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { HudDrawCtx } from '../widget';
import type { MenuTextEntry } from '@weasel-js/menu';
import { DEFAULT_MENU_METRICS as m, drawPanel, OPENED_VALUES } from './drawPanel';
import { composeEdit, editKey, insertText, startEdit, type EditMods, type HudTextEdit } from './textEdit';

const entry: MenuTextEntry = { kind: 'text', key: 'name', label: 'Name', value: undefined, set: vi.fn() };

/** `keys` fed to an edit of `draft`, each a key or a key with modifiers. */
function run(draft: string, keys: readonly (string | [string, EditMods])[]): HudTextEdit | null {
  let edit: HudTextEdit | null = startEdit(entry, draft);
  for (const k of keys) {
    if (!edit) break;
    const [key, mods] = typeof k === 'string' ? [k, {}] : k;
    edit = editKey(edit, key, mods).edit;
  }
  return edit;
}
const shown = (e: HudTextEdit | null) => {
  const chars = Array.from(e!.draft);
  chars.splice(e!.caret, 0, '|');
  return chars.join('');
};

describe('editKey', () => {
  it('moves the caret with the arrows, Home and End, inside the text', () => {
    expect(shown(run('abc', ['ArrowLeft']))).toBe('ab|c');
    expect(shown(run('abc', ['Home', 'ArrowLeft']))).toBe('|abc');
    expect(shown(run('abc', ['Home', 'ArrowRight', 'End', 'ArrowRight']))).toBe('abc|');
    expect(shown(run('abc', [['ArrowLeft', { mod: true }]]))).toBe('|abc');
  });

  it('types and deletes at the caret', () => {
    expect(shown(run('abc', ['ArrowLeft', 'X']))).toBe('abX|c');
    expect(shown(run('abc', ['ArrowLeft', 'Backspace']))).toBe('a|c');
    expect(shown(run('abc', ['Home', 'Delete']))).toBe('|bc');
    expect(shown(run('abc', ['Home', 'Backspace', 'End', 'Delete']))).toBe('abc|');
  });

  it('selects with Shift, replaces or deletes the selection, and collapses it with a bare arrow', () => {
    const sel = run('abcd', [['ArrowLeft', { shift: true }], ['ArrowLeft', { shift: true }]])!;
    expect([sel.caret, sel.anchor]).toEqual([2, 4]);
    expect(shown(editKey(sel, 'Z').edit)).toBe('abZ|');
    expect(shown(editKey(sel, 'Backspace').edit)).toBe('ab|');
    expect(shown(editKey(sel, 'Delete').edit)).toBe('ab|');
    expect(editKey(sel, 'ArrowRight').edit).toMatchObject({ caret: 4, anchor: 4 });
    expect(editKey(sel, 'ArrowLeft').edit).toMatchObject({ caret: 2, anchor: 2 });
  });

  it('selects all on Mod+A and types nothing else under Mod', () => {
    const all = run('abc', [['a', { mod: true }]])!;
    expect([all.anchor, all.caret]).toEqual([0, 3]);
    expect(run('abc', [['z', { mod: true }]])!.draft).toBe('abc');
  });

  it('moves by a word with Alt, collapsing a selection first, and selects by a word with Alt+Shift', () => {
    const alt = { alt: true };
    expect(shown(run('one two  three', [['ArrowLeft', alt]]))).toBe('one two  |three');
    expect(shown(run('one two  three', [['ArrowLeft', alt], ['ArrowLeft', alt]]))).toBe('one |two  three');
    expect(shown(run('one, two', ['Home', ['ArrowRight', alt], ['ArrowRight', alt]]))).toBe('one, two|');
    expect(shown(run('héllo wörld', ['Home', ['ArrowRight', alt]]))).toBe('héllo| wörld');
    const sel = run('ab cd ef', [['ArrowLeft', { shift: true }], ['ArrowLeft', { shift: true, alt: true }]])!;
    expect([sel.caret, sel.anchor]).toEqual([6, 8]);
    expect(editKey(sel, 'ArrowLeft', alt).edit).toMatchObject({ caret: 3, anchor: 3 });
  });

  it('deletes a word with Alt+Backspace and Alt+Delete, or the selection when there is one', () => {
    const alt = { alt: true };
    expect(shown(run('one two  three', [['Backspace', alt]]))).toBe('one two  |');
    expect(shown(run('one two  three', [['Backspace', alt], ['Backspace', alt]]))).toBe('one |');
    expect(shown(run('one, two', ['Home', ['Delete', alt]]))).toBe('|, two');
    expect(shown(run('one, two', ['Home', ['Delete', alt], ['Delete', alt]]))).toBe('|');
    expect(shown(run('ab cd', [['ArrowLeft', { shift: true }], ['Backspace', alt]]))).toBe('ab c|');
    expect(shown(run('ab', ['Home', ['Backspace', alt]]))).toBe('|ab');
  });

  it('holds a composition in place of the selection until it is entered', () => {
    const sel = run('abcd', [['ArrowLeft', { shift: true }], ['ArrowLeft', { shift: true }]])!;
    const composing = composeEdit(sel, 'に');
    expect(composing).toMatchObject({ draft: 'abcd', caret: 2, anchor: 4, preedit: 'に' });
    expect(composeEdit(composing, '')).not.toHaveProperty('preedit');
    const entered = insertText(composing, '日本');
    expect(shown(entered)).toBe('ab日本|');
    expect(entered).not.toHaveProperty('preedit');
  });

  it('counts a character outside the BMP as one', () => {
    expect(shown(run('a😀b', ['ArrowLeft', 'ArrowLeft', 'Backspace']))).toBe('|😀b');
  });

  it('ends on Enter with the draft and on Escape with nothing', () => {
    expect(editKey(startEdit(entry, 'x'), 'Enter')).toEqual({ edit: null, commit: 'x' });
    expect(editKey(startEdit(entry, 'x'), 'Escape')).toEqual({ edit: null });
  });
});

const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: {
    '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee', '--wzl-accent-soft': '#246',
    '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': '#0008', '--wzl-radius-md': '6px',
  },
  color: () => undefined,
} as never as HudDrawCtx;
const b = { x: 100, y: 50, w: 240, h: 40 };
const measure = (t: string) => Array.from(t).length * 7;
const draw = (edit: HudTextEdit) => drawPanel(ctx, b, [entry], null, m, undefined, { ...OPENED_VALUES, editing: edit, measure });
/** The x of the caret: the last stroke-only path, a vertical line. */
const caretX = (cmds: readonly DrawCommand[]): number => {
  const c = cmds.filter((x) => x.kind === 'path' && x.stroke && !x.fill).at(-1)!;
  return (c as { path: { coords: ArrayLike<number> } }).path.coords[0]!;
};

describe('drawPanel: a text row being typed into', () => {
  const right = b.x + b.w - m.padX - 3;

  it('puts the caret before the characters after it, and draws the selection behind the text', () => {
    const atEnd = draw(startEdit(entry, 'abcd'));
    const mid = draw({ ...startEdit(entry, 'abcd'), caret: 1, anchor: 3 });
    expect(caretX(atEnd)).toBe(right + 1);
    expect(caretX(mid)).toBe(right - 3 * 7 + 1);
    const sel = mid.find((c) => c.kind === 'path' && c.fill && JSON.stringify(c.fill).includes('#246'));
    expect(sel).toMatchObject({ path: { kind: 'rect', x: right - 3 * 7, width: 2 * 7 } });
    expect(atEnd.some((c) => JSON.stringify(c).includes('#246'))).toBe(false);
  });

  it('draws a composition where the selection was, underlined, with the caret after it', () => {
    const cmds = draw(composeEdit({ ...startEdit(entry, 'abcd'), caret: 1, anchor: 3 }, 'xyz'));
    const texts = cmds.flatMap((c) => (c.kind === 'text' ? [c.runs.map((r) => r.text).join('')] : []));
    expect(texts).toContain('axyzd');
    expect(caretX(cmds)).toBe(right - 1 * 7 + 1);
    const strokes = cmds.filter((x) => x.kind === 'path' && x.stroke && !x.fill);
    const underline = (strokes.at(-2) as { path: { coords: ArrayLike<number> } }).path.coords;
    expect([underline[0], underline[2]]).toEqual([right - 4 * 7, right - 7]);
    expect(cmds.some((c) => JSON.stringify(c).includes('#246'))).toBe(false);
  });
});
