import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar } from './MenuBar';

afterEach(cleanup);

const SCHEMA: PrefGroup = pref.group('', {
  on: pref.boolean('On', true),
  view: pref.group('View', {
    snap: pref.boolean('Snap', true),
    units: pref.enum('Units', 'mm', [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }]),
  }, { as: 'menu' }),
  edit: { ...pref.group('Edit', { grid: pref.boolean('Grid', false) }, { as: 'menu' }), enableIf: { path: 'on' } },
});

const setup = () => render(<ActionsProvider><MenuBar schema={SCHEMA} values={{}} onChange={() => {}} /></ActionsProvider>);
const checked = (name: string) => screen.getByText(name).closest('[aria-checked]')!.getAttribute('aria-checked');

describe('MenuBar defaults', () => {
  it("shows a menu row its values lack at the leaf's default", () => {
    setup();
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'View' }));
    expect(checked('Snap')).toBe('true');
    expect(checked('Millimeters')).toBe('true');
    expect(checked('Pixels')).toBe('false');
  });

  it('reads an unset path at its default for a title condition', () => {
    setup();
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-disabled')).not.toBe('true');
  });
});
