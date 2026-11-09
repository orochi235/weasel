import { describe, it, expect } from 'vitest';
import type { GestureSpec } from '@weasel-js/gestures';
import type { Action } from './action';
import { actionShortcuts, keySpecShortcut } from './actionShortcuts';
import { tuneAction } from './tuning';

const base = { id: 'a', label: 'A' } as const;
const of = (defaultBinding: unknown) => actionShortcuts({ ...base, defaultBinding } as Action);

describe('actionShortcuts', () => {
  it('reads a bare single spec', () => {
    expect(of({ kind: 'key', key: 'd', mods: { mod: true } }))
      .toEqual([{ key: 'd', mod: true, alt: false, shift: false }]);
  });

  it('returns every keyboard binding an action declares', () => {
    expect(of([
      { spec: { kind: 'key', key: [']'], mods: { mod: true } }, opts: {} },
      { spec: { kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } }, opts: {} },
      { spec: { kind: 'key', key: [']', '‘'], mods: { mod: true, alt: true } }, opts: {} },
    ])).toEqual([
      { key: ']', mod: true, alt: false, shift: false },
      { key: ']', mod: true, alt: false, shift: true },
      { key: ']', mod: true, alt: true, shift: false },
    ]);
  });

  it('names the unshifted spelling of a key list', () => {
    // `['[', '{']` is one shortcut spelled two ways — the shifted keycap
    // reports as '{'. Listing both would read as two shortcuts.
    expect(of([{ spec: { kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } }, opts: {} }]))
      .toEqual([{ key: '[', mod: true, alt: false, shift: true }]);
  });

  it('treats an optional modifier as not required', () => {
    expect(of([{ spec: { kind: 'key', key: 'z', mods: { mod: true, shift: 'optional' } }, opts: {} }]))
      .toEqual([{ key: 'z', mod: true, alt: false, shift: false }]);
  });

  it('gives a binding that requires Ctrl or Meta no chip, since a chip cannot draw either', () => {
    expect(keySpecShortcut({ kind: 'key', key: 'Tab', mods: { ctrl: true } })).toBeUndefined();
    expect(keySpecShortcut({ kind: 'key', key: 'q', mods: { meta: true } })).toBeUndefined();
    expect(of([
      { spec: { kind: 'key', key: 'q', mods: { ctrl: true } }, opts: {} },
      { spec: { kind: 'key', key: 'q', mods: { mod: true } }, opts: {} },
    ])).toEqual([{ key: 'q', mod: true, alt: false, shift: false }]);
  });

  it('gives one that requires Ctrl or Meta beside mod no chip either, as the matcher requires both', () => {
    // Cmd+Ctrl+F on a Mac and Ctrl+Win+F elsewhere: drawn as ⌘F or Ctrl+F, the chip would name a different chord.
    expect(keySpecShortcut({ kind: 'key', key: 'f', mods: { mod: true, ctrl: true } })).toBeUndefined();
    expect(keySpecShortcut({ kind: 'key', key: 'f', mods: { mod: true, meta: true } })).toBeUndefined();
    expect(keySpecShortcut({ kind: 'key', key: 'f', mods: { mod: true, ctrl: 'optional' } }))
      .toEqual({ key: 'f', mod: true, alt: false, shift: false });
  });

  it('collapses bindings that an optional modifier made identical', () => {
    // Held-or-not on one binding and a second spelling it out are one
    // shortcut to a reader, not two rows.
    expect(of([
      { spec: { kind: 'key', key: 'z', mods: { mod: true, shift: 'optional' } }, opts: {} },
      { spec: { kind: 'key', key: 'z', mods: { mod: true } }, opts: {} },
    ])).toEqual([{ key: 'z', mod: true, alt: false, shift: false }]);
  });

  it('skips non-keyboard bindings', () => {
    expect(of([
      { spec: { kind: 'drag', mods: { alt: true } }, opts: {} },
      { spec: { kind: 'key', key: 'v' }, opts: {} },
    ])).toEqual([{ key: 'v', mod: false, alt: false, shift: false }]);
  });

  it('is empty for an action with no keyboard binding', () => {
    expect(of([{ spec: { kind: 'drag' }, opts: {} }])).toEqual([]);
    expect(actionShortcuts({ ...base } as Action)).toEqual([]);
  });
});

describe('keySpecShortcut', () => {
  it('has no chip for a spec a reader cannot press', () => {
    // The seam ToolkitBuilder falls through on to render its own tag.
    expect(keySpecShortcut({ kind: 'drag', mods: { alt: true } } as GestureSpec)).toBeUndefined();
    expect(keySpecShortcut({ kind: 'key', key: '' } as GestureSpec)).toBeUndefined();
  });
});

describe('actionShortcuts with params', () => {
  it('keeps only the bindings that pass those params', () => {
    const reorder = {
      ...base,
      defaultBinding: [
        { spec: { kind: 'key', key: [']'], mods: { mod: true } }, opts: { params: { distance: 'adjacent' } } },
        { spec: { kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } }, opts: { params: { distance: 'extreme' } } },
      ],
    } as unknown as Action;
    expect(actionShortcuts(reorder, { distance: 'extreme' }))
      .toEqual([{ key: ']', mod: true, alt: false, shift: true }]);
  });

  it('reads params a binding gives as a thunk', () => {
    const flip = {
      ...base,
      defaultBinding: [
        { spec: { kind: 'key', key: 'h', mods: { shift: true } }, opts: { params: () => ({ axis: 'x' }) } },
        { spec: { kind: 'key', key: 'v', mods: { shift: true } }, opts: { params: () => ({ axis: 'y' }) } },
      ],
    } as unknown as Action;
    expect(actionShortcuts(flip, { axis: 'y' })).toEqual([{ key: 'v', mod: false, alt: false, shift: true }]);
  });
});

describe('actionShortcuts under a tuning', () => {
  const flip = {
    id: 'flip', label: 'Flip',
    variants: [{ key: 'x', label: 'Flip Horizontal', params: { axis: 'x' } }, { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } }],
    defaultBinding: [{ kind: 'key', key: 'H' }, { spec: { kind: 'key', key: 'V' }, opts: { params: { axis: 'y' } } }],
    invoker: { timing: 'immediate', run: () => {} },
  } as unknown as Action;

  it('gives a variant the key whose binding fires it through the tuning\'s params', () => {
    const tuned = tuneAction(flip, [{ params: { axis: 'x' } }]);
    expect(actionShortcuts(tuned, { axis: 'x' }).map((s) => s.key)).toEqual(['H']);
    expect(actionShortcuts(tuned, { axis: 'y' }).map((s) => s.key)).toEqual(['V']);
  });

  it('gives an untuned variant no key from a binding that passes no params', () => {
    expect(actionShortcuts(flip, { axis: 'x' })).toEqual([]);
  });
});
