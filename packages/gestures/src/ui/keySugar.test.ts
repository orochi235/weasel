import { describe, it, expect } from 'vitest';
import { bindingSpec, held, key, keySpecRoute, unbound } from './keySugar';

describe('key', () => {
  it('reads modifiers and the key', () => {
    expect(key('Mod+Shift+K')).toEqual({ kind: 'key', key: 'K', mods: { mod: true, shift: true } });
  });

  it('reads modifier names case-insensitively, with their aliases', () => {
    expect(key('cmd+option+control+x')).toEqual({ kind: 'key', key: 'x', mods: { meta: true, alt: true, ctrl: true } });
  });

  it('names the keys a KeyboardEvent spells differently', () => {
    expect(key('Space')).toEqual({ kind: 'key', key: ' ' });
    expect(key('Esc')).toEqual({ kind: 'key', key: 'Escape' });
  });

  it('takes a plus as the key', () => {
    expect(key('Mod++')).toEqual({ kind: 'key', key: '+', mods: { mod: true } });
  });

  it('throws on an unknown modifier or no key', () => {
    expect(() => key('Hyper+K')).toThrow(/unknown modifier "Hyper"/);
    expect(() => key('')).toThrow(/names no key/);
  });
});

describe('held', () => {
  it('is the key-held form of the same keystroke', () => {
    expect(held('Alt+Space')).toEqual({ kind: 'key-held', key: ' ', mods: { alt: true } });
  });
});

describe('unbound', () => {
  it('is null', () => {
    expect(unbound()).toBeNull();
  });
});

describe('bindingSpec', () => {
  it('reads a route string', () => {
    expect(bindingSpec('[*:*] keyDown(=) +mod')).toEqual(key('Mod+='));
  });

  it('passes a spec or null through', () => {
    const spec = key('A');
    expect(bindingSpec(spec)).toBe(spec);
    expect(bindingSpec(null)).toBeNull();
  });
});

describe('keySpecRoute', () => {
  it.each(['Alt+2', 'Mod+Shift+K', 'Space', 'Escape', 'Ctrl+Meta+ArrowLeft'])('round-trips %s', (s) => {
    expect(bindingSpec(keySpecRoute(key(s))!)).toEqual(key(s));
    expect(bindingSpec(keySpecRoute(held(s))!)).toEqual(held(s));
  });

  it.each(['?', ')', '*'])('gives null for %s, which a route cannot spell', (k) => {
    expect(keySpecRoute(key(k))).toBeNull();
  });

  it('writes an optional modifier into the key slot', () => {
    expect(keySpecRoute({ kind: 'key', key: 'z', mods: { shift: 'optional', mod: true } }))
      .toBe('[*:*] keyDown(z?shift) +mod');
  });
});
