import { heldKeySpec } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { createLoupeActions, LOUPE_AIM_ID, LOUPE_LEAVE_ID, LOUPE_PEEK_ID } from './loupeActions';

const input = {
  shown: () => false,
  setPeeking: () => {},
  magnifyBy: () => {},
  aimAt: () => {},
  leave: () => {},
};

const ANY_MODS = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' };

function specOf(id: string, peekKey: string | null = 'Alt'): unknown {
  const action = createLoupeActions(input, peekKey).find((a) => a.id === id)!;
  return (action.defaultBinding as { spec: unknown }[])[0]!.spec;
}

function peekSpec(peekKey: string): unknown {
  const peek = createLoupeActions(input, peekKey).find((a) => a.id === LOUPE_PEEK_ID)!;
  return (peek.defaultBinding as { spec: unknown }[])[0]!.spec;
}

describe('the loupe peek binding', () => {
  it('lets a modifier peek key match whatever modifiers are down', () => {
    expect(peekSpec('Alt')).toEqual({
      kind: 'key-held',
      key: 'Alt',
      mods: { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' },
    });
  });

  it('holds any other peek key to the rule every held key follows', () => {
    expect(peekSpec('z')).toEqual({
      kind: 'key-held',
      key: 'z',
      mods: { alt: 'optional', shift: 'optional' },
    });
    expect(peekSpec('z')).toEqual(heldKeySpec('z'));
  });

  it('registers no peek action without a key', () => {
    expect(createLoupeActions(input, null).map((a) => a.id)).not.toContain(LOUPE_PEEK_ID);
  });
});

describe('the loupe aim bindings', () => {
  it('follow the pointer pressed or not, under any modifiers', () => {
    expect(specOf(LOUPE_AIM_ID)).toEqual({ kind: 'hover', held: 'optional', mods: ANY_MODS });
    expect(specOf(LOUPE_AIM_ID, null)).toEqual({ kind: 'hover', held: 'optional', mods: ANY_MODS });
  });

  it('learn when the pointer leaves the host', () => {
    expect(specOf(LOUPE_LEAVE_ID)).toEqual({ kind: 'hover', motion: 'leave', mods: ANY_MODS });
  });

  it('hand the aim its client point', () => {
    const seen: [number, number][] = [];
    const aim = createLoupeActions({ ...input, aimAt: (x, y) => seen.push([x, y]) }, null)
      .find((a) => a.id === LOUPE_AIM_ID)!;
    if (aim.invoker?.timing !== 'immediate') throw new Error('aim is not immediate');
    aim.invoker.run({} as never, { clientX: 7, clientY: 9 });
    expect(seen).toEqual([[7, 9]]);
  });
});
