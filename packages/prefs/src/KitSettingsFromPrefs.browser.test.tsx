/**
 * The bridge's `css` reaching computed style: jsdom resolves no custom
 * property, so only a browser can say the adopted sheet and the attributes
 * meet.
 */
import { createMemoryAdapter } from '@weasel-js/storage';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { pref } from './build';
import { openPrefsSync } from './open';
import { KitSettingsFromPrefs } from './react';

const SCHEMA = pref.group('Prefs', {
  kit: pref.group('Kit', {
    look: pref.group('Look', { mode: pref.enum('Mode', 'dark', ['dark', 'light']) }),
    tree: pref.group('Tree', { typeaheadMs: pref.number('Typeahead', 500, { splitBy: ['kit.look.mode'] }) }),
  }),
});

let root: Root | null = null;
let page: HTMLElement | null = null;
afterEach(() => {
  root?.unmount();
  page?.remove();
  root = null;
  page = null;
});

const PROPERTY = '--wzl-kit-tree-typeahead-ms';

function mount(within: (page: HTMLElement) => HTMLElement) {
  page = document.createElement('div');
  document.body.appendChild(page);
  const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'p.' });
  const mountPoint = within(page);
  root = createRoot(mountPoint);
  flushSync(() => root!.render(createElement(KitSettingsFromPrefs, { store, at: 'kit', css: true })));
  return { store, mountPoint };
}

describe('KitSettingsFromPrefs css', () => {
  it('writes the store into a computed custom property on the document, and follows a write', () => {
    const { store } = mount((p) => p);
    const read = () => getComputedStyle(document.documentElement).getPropertyValue(PROPERTY).trim();
    expect(read()).toBe('500');
    store.set('kit.tree.typeaheadMs', 250);
    expect(read()).toBe('250');
    store.split('kit.tree.typeaheadMs', 'kit.look.mode');
    store.set('kit.tree.typeaheadMs', 900, { at: { 'kit.look.mode': 'light' } });
    store.set('kit.look.mode', 'light');
    expect(read()).toBe('900');
    root!.unmount();
    root = null;
    expect(read()).toBe('');
  });

  it('writes into a shadow root, on its host', () => {
    const { store } = mount((p) => {
      const shadow = p.attachShadow({ mode: 'open' });
      const inner = document.createElement('div');
      shadow.appendChild(inner);
      return inner;
    });
    const read = () => getComputedStyle(page!).getPropertyValue(PROPERTY).trim();
    expect(read()).toBe('500');
    store.split('kit.tree.typeaheadMs', 'kit.look.mode');
    store.set('kit.tree.typeaheadMs', 900, { at: { 'kit.look.mode': 'light' } });
    store.set('kit.look.mode', 'light');
    expect(page!.getAttribute('data-wzl-kit-look-mode')).toBe('light');
    expect(read()).toBe('900');
    expect(getComputedStyle(document.documentElement).getPropertyValue(PROPERTY)).toBe('');
  });
});
