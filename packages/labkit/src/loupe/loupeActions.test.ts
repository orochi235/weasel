import { describe, expect, it } from 'vitest';
import { heldKeySpec } from '@weasel-js/core';
import { createLoupeActions, LOUPE_PEEK_ID } from './loupeActions';

const input = { shown: () => false, setPeeking: () => {}, magnifyBy: () => {} };

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
    expect(peekSpec('z')).toEqual({ kind: 'key-held', key: 'z' });
    expect(peekSpec('z')).toEqual(heldKeySpec('z'));
  });

  it('registers no peek action without a key', () => {
    expect(createLoupeActions(input, null).map((a) => a.id)).not.toContain(LOUPE_PEEK_ID);
  });
});
