import { heldKeySpec } from '@weasel-js/routing';
import { describe, expect, it } from 'vitest';
import {
  createLoupeActions,
  LOUPE_AIM_ID,
  LOUPE_LEAVE_ID,
  LOUPE_PEEK_ID,
  LOUPE_PICK_ID,
} from './actions';

const input = {
  shown: () => false,
  setPeeking: () => {},
  magnifyBy: () => {},
  aimAt: () => {},
  leave: () => {},
  dropping: () => false,
  pickAtPointer: () => {},
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

  it('hand the aim its client point, and whether a button is held', () => {
    const seen: [number, number, boolean][] = [];
    const aim = createLoupeActions({ ...input, aimAt: (x, y, held) => seen.push([x, y, held]) }, null).find(
      (a) => a.id === LOUPE_AIM_ID,
    )!;
    if (aim.invoker?.timing !== 'immediate') throw new Error('aim is not immediate');
    aim.invoker.run({} as never, { clientX: 7, clientY: 9 });
    aim.invoker.run({} as never, { clientX: 8, clientY: 9, held: true });
    expect(seen).toEqual([[7, 9, false], [8, 9, true]]);
  });

});

describe('the eyedropper click', () => {
  it('picks at the pointer while the eyedropper is on, and declines while it is off', () => {
    let on = false;
    let picks = 0;
    const pick = createLoupeActions(
      {
        ...input,
        dropping: () => on,
        pickAtPointer: () => {
          picks++;
        },
      },
      null,
    ).find((a) => a.id === LOUPE_PICK_ID)!;
    expect(specOf(LOUPE_PICK_ID)).toEqual({ kind: 'click', mods: ANY_MODS });
    expect(pick.enabled?.({} as never)).toBe('not-applicable');
    on = true;
    expect(pick.enabled?.({} as never)).toBe(true);
    if (pick.invoker?.timing !== 'immediate') throw new Error('pick is not immediate');
    pick.invoker.run({} as never, {});
    expect(picks).toBe(1);
  });
});
