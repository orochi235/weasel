import { describe, it, expect } from 'vitest';
import type { Action } from './registry';
import { actionShortcuts } from './actionShortcuts';

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
