import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import { browserReservedChord } from '@weasel-js/routing';
import type { KeySpec } from '@weasel-js/gestures';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { DEFAULT_ACCESS_CHORD, MenuBar } from './MenuBar';
import { openBindings } from './useMenuBarKeys';

afterEach(cleanup);

const TITLES = ['File', 'Edit', 'View', 'Window', 'Help'];
const SCHEMA: PrefGroup = pref.group('', Object.fromEntries(TITLES.map((t) => [
  t.toLowerCase(),
  { ...pref.group(t, { on: pref.boolean('On', false) }, { as: 'menu' }), access: t },
])));

/** The default chord's bindings a browser also takes: Alt+F, E, V and H open its own menus off a Mac. */
const reserved = (): KeySpec[] =>
  (openBindings(TITLES.map((t) => ({ key: t.toLowerCase(), access: t })), DEFAULT_ACCESS_CHORD) as readonly { spec: KeySpec }[])
    .map((b) => b.spec)
    .filter((spec) => browserReservedChord(spec) !== null);

const press = (target: Element, spec: KeySpec) => {
  const letter = spec.key as string;
  const event = createEvent.keyDown(target, { key: letter, code: `Key${letter.toUpperCase()}`, altKey: true });
  fireEvent(target, event);
  return event;
};

describe('the menu bar access keys a browser reserves', () => {
  it('include Alt+F, E, V and H under the default chord', () => {
    expect(reserved().map((s) => s.key)).toEqual(['f', 'e', 'v', 'h']);
  });

  it('leave each to the browser while focus is outside the bar, and take it while focus is on a title', () => {
    render(<ActionsProvider><MenuBar schema={SCHEMA} values={{}} onChange={() => {}} /></ActionsProvider>);
    for (const spec of reserved()) {
      const outside = press(document.body, spec);
      expect(outside.defaultPrevented, spec.key as string).toBe(false);
      expect(screen.queryByRole('menu')).toBeNull();
    }
    const file = screen.getByRole('menuitem', { name: 'File' });
    act(() => file.focus());
    const inside = press(file, reserved()[0]!);
    expect(inside.defaultPrevented).toBe(true);
    expect(screen.getByRole('menu')).toBeDefined();
  });
});
