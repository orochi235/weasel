import { describe, expect, it } from 'vitest';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { menuBarTitles, shownMenuBar } from './menuBarTitles';

describe('menuBarTitles', () => {
  it('keeps a loose setting keyed `__proto__` in its run, as its own key', () => {
    const children = {};
    Object.defineProperty(children, '__proto__', { value: { kind: 'boolean', name: 'P', default: false }, enumerable: true, writable: true, configurable: true });
    const [run] = menuBarTitles({ name: 'Bar', children } as PrefGroup);
    expect(run!.kind).toBe('other');
    expect(Object.keys((run as Extract<typeof run, { kind: 'other' }>).schema.children)).toEqual(['__proto__']);
  });

  it('throws naming both titles when two declare one access letter, in either case', () => {
    const schema = pref.group('', {
      file: { ...pref.group('File', {}, { as: 'menu' }), access: 'f' },
      format: { ...pref.group('Format', {}, { as: 'menu' }), access: 'F' },
    });
    expect(() => menuBarTitles(schema)).toThrow('titles "File" and "Format" both declare the access letter "f"');
  });

  it('throws for a clash with a title its conditions hide', () => {
    const schema = pref.group('', {
      on: pref.boolean('On', false),
      file: { ...pref.group('File', {}, { as: 'menu' }), access: 'f' },
      format: { ...pref.group('Format', {}, { as: 'menu' }), access: 'f', showIf: { path: 'on' } },
    });
    expect(() => shownMenuBar(schema, () => false)).toThrow('both declare the access letter "f"');
  });
});
