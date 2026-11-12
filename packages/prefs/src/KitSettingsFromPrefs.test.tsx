import { act, render, screen } from '@testing-library/react';
import { useKitSettings } from '@weasel-js/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { useSyncExternalStore } from 'react';
import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { openPrefsSync } from './open';
import { KitSettingsFromPrefs } from './react';

const SCHEMA = pref.group('Prefs', {
  app: pref.group('App', { zoom: pref.number('Zoom', 1) }),
  kit: pref.group('Kit', {
    look: pref.group('Look', { mode: pref.enum('Mode', 'dark', ['dark', 'light']) }),
    tree: pref.group('Tree', { typeaheadMs: pref.number('Typeahead', 500, { scopes: [{ selector: 'kit.look.mode' }] }) }),
  }),
});

const open = () => openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'p.' });

function Read({ path }: { path: string }) {
  const settings = useKitSettings();
  const read = () => String((settings.get as (path: string) => unknown)(path));
  return <span data-testid={path}>{useSyncExternalStore(settings.subscribe, read, read)}</span>;
}

describe('KitSettingsFromPrefs', () => {
  it('provides the subtree at `at`, and follows a store write', () => {
    const store = open();
    render(
      <KitSettingsFromPrefs store={store} at="kit">
        <Read path="tree.typeaheadMs" />
        <Read path="app.zoom" />
      </KitSettingsFromPrefs>,
    );
    expect(screen.getByTestId('tree.typeaheadMs').textContent).toBe('500');
    expect(screen.getByTestId('app.zoom').textContent).toBe('undefined');
    act(() => store.set('kit.tree.typeaheadMs', 250));
    expect(screen.getByTestId('tree.typeaheadMs').textContent).toBe('250');
  });

  it('provides the whole store without `at`', () => {
    render(
      <KitSettingsFromPrefs store={open()}>
        <Read path="app.zoom" />
      </KitSettingsFromPrefs>,
    );
    expect(screen.getByTestId('app.zoom').textContent).toBe('1');
  });

  it('with `css`, writes a sheet and sets the selector attributes on the root, and takes both away on unmount', () => {
    const store = open();
    const sheet = () => [
      ...(document.adoptedStyleSheets ?? []).flatMap((s) => [...s.cssRules].map((r) => r.cssText)),
      ...[...document.head.querySelectorAll('style')].map((s) => s.textContent),
    ].join('\n');
    const { unmount } = render(<KitSettingsFromPrefs store={store} at="kit" css />);
    expect(document.documentElement.getAttribute('data-wzl-kit-look-mode')).toBe('dark');
    expect(sheet()).toContain('--wzl-kit-tree-typeahead-ms: 500;');
    act(() => store.set('kit.tree.typeaheadMs', 250));
    expect(sheet()).toContain('--wzl-kit-tree-typeahead-ms: 250;');
    act(() => store.set('kit.look.mode', 'light'));
    expect(document.documentElement.getAttribute('data-wzl-kit-look-mode')).toBe('light');
    unmount();
    expect(document.documentElement.hasAttribute('data-wzl-kit-look-mode')).toBe(false);
    expect(sheet()).not.toContain('--wzl-kit-');
  });

  it('with two `css` bridges on one root, keeps the attributes until the last one unmounts', () => {
    const a = open();
    const b = open();
    act(() => b.set('kit.look.mode', 'light'));
    const first = render(<KitSettingsFromPrefs store={a} at="kit" css />);
    const second = render(<KitSettingsFromPrefs store={b} at="kit" css />);
    expect(document.documentElement.getAttribute('data-wzl-kit-look-mode')).toBe('light');
    second.unmount();
    expect(document.documentElement.getAttribute('data-wzl-kit-look-mode')).toBe('dark');
    first.unmount();
    expect(document.documentElement.hasAttribute('data-wzl-kit-look-mode')).toBe(false);
  });
});
