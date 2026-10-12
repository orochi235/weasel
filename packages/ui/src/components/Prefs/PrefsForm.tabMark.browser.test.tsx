import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const TABS: PrefGroup = {
  name: 'Preferences',
  children: {
    light: { name: 'Light', as: 'tab', children: { ink: { kind: 'string', name: 'Ink', description: '', default: '' } } },
    dark: { name: 'Dark', as: 'tab', children: { glow: { kind: 'string', name: 'Glow', description: '', default: '' } } },
  },
};

const outline = (el: Element): string => getComputedStyle(el).outlineStyle;

it('draws no selection mark on the open tab of a run while nothing is selected', () => {
  render(<PrefsForm layout="rail" schema={TABS} onChange={() => {}} />);
  expect(outline(screen.getByRole('tab', { name: 'Light' }))).toBe('none');
});

it('draws a selected tab\'s mark on its panel while it is open, and on the tab once another is', () => {
  render(<PrefsForm layout="rail" schema={TABS} onChange={() => {}} selected={['dark']} />);
  expect(outline(screen.getByRole('tab', { name: 'Dark' }))).toBe('none');
  expect(outline(screen.getByRole('tabpanel'))).toBe('solid');
  fireEvent.click(screen.getByRole('tab', { name: 'Light' }));
  expect(outline(screen.getByRole('tab', { name: 'Dark' }))).toBe('solid');
  expect(outline(screen.getByRole('tab', { name: 'Light' }))).toBe('none');
});
