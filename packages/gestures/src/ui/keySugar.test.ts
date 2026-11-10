import { describe, it, expect } from 'vitest';
import { bindingSpec, held, key, keySpecRoute, unbound } from './keySugar';
import type { KeySpec } from './spec';

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
    expect(key('+')).toEqual({ kind: 'key', key: '+' });
  });

  it('throws on an unknown modifier or no key', () => {
    expect(() => key('Hyper+K')).toThrow(/unknown modifier "Hyper"/);
    expect(() => key('')).toThrow(/names no key/);
    expect(() => key('constructor+K')).toThrow(/unknown modifier "constructor"/);
    expect(key('constructor')).toEqual({ kind: 'key', key: 'constructor' });
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

  it.each(['Shift+?', 'Shift+)', 'Mod+Shift+?'])('round-trips %s, a key the route grammar used to refuse', (s) => {
    expect(bindingSpec(keySpecRoute(key(s))!)).toEqual(key(s));
  });

  it.each(['*'])('gives null for %s, which a route cannot spell', (k) => {
    expect(keySpecRoute(key(k))).toBeNull();
  });

  it('writes the space bar by name', () => {
    expect(keySpecRoute(held('Mod+Space'))).toBe('[*:*] keyHeld(Space) +mod');
  });

  it('writes the phase a spec is live in', () => {
    expect(keySpecRoute({ kind: 'key', key: 'Delete', phase: 'engaged' })).toBe('[engaged] keyDown(Delete)');
    const spec: KeySpec = { kind: 'key', key: 'z', mods: { mod: true }, phase: [{ channel: 'rect', phase: 'engaged' }, { channel: '&', phase: 'initial' }] };
    expect(keySpecRoute(spec)).toBe('[rect:engaged,initial] keyDown(z) +mod');
    expect(bindingSpec(keySpecRoute(spec)!)).toEqual(spec);
  });

  it('gives null for a physical key code, several keys, or an empty phase list, which a route cannot spell', () => {
    expect(keySpecRoute({ kind: 'key', key: 'p', code: 'KeyP', mods: { alt: true } })).toBeNull();
    expect(keySpecRoute({ kind: 'key', key: [']', '‘'], mods: { mod: true, alt: true } })).toBeNull();
    expect(keySpecRoute({ kind: 'key', key: ['z'] })).toBe('[*:*] keyDown(z)');
    expect(keySpecRoute({ kind: 'key', key: 'z', phase: [] })).toBeNull();
  });

  it('writes an optional modifier into the key slot', () => {
    expect(keySpecRoute({ kind: 'key', key: 'z', mods: { shift: 'optional', mod: true } }))
      .toBe('[*:*] keyDown(z?shift) +mod');
  });
});
