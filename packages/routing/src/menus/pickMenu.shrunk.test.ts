/** Children `mergeMenuDefs` lost, as its property test shrank them. */
import { describe, expect, it } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { mergeMenuDefs } from './pickMenu';

describe('mergeMenuDefs, shrunk', () => {
  it('keeps a child keyed __proto__ as a child', () => {
    const children = JSON.parse('{"__proto__": {"kind": "action", "name": "p", "description": ""}}');
    const merged = mergeMenuDefs([
      { def: { id: 'm', menu: pref.group('', {}) }, owner: null },
      { def: { id: 'm', menu: { ...pref.group('', {}), children } }, owner: null },
    ], null)[0]!;
    expect(Object.getPrototypeOf(merged.menu.children)).toBe(Object.prototype);
    expect(Object.keys(merged.menu.children)).toEqual(['~sep1', '__proto__']);
  });

  it('puts the separator beside a child that already holds its key', () => {
    const merged = mergeMenuDefs([
      { def: { id: 'm', menu: pref.group('', { '~sep1': pref.action('kept') }) }, owner: null },
      { def: { id: 'm', menu: pref.group('', { b: pref.action('b') }) }, owner: null },
    ], null)[0]!;
    expect(Object.keys(merged.menu.children)).toEqual(['~sep1', '~sep2', 'b']);
    expect(merged.menu.children['~sep1']!.kind).toBe('action');
  });
});
