import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';
import { renderWithIcons } from '../../testing/withIcons';

// What color a flagged chip resolves to is the theme's cascade, which jsdom does not do.

afterEach(cleanup);

const ctx = (value: unknown): PrefRenderContext => ({
  path: 'x', pref: { kind: 'enum-options', name: 'X', description: '', default: undefined }, value, setValue: () => {}, auto: false, setAuto: () => {},
});

test('a flagged option draws its chip in another color than a sound one', () => {
  renderWithIcons(<div style={{ width: 400 }}>{ATTR_RENDERERS['enum-options'](ctx([{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }]))}</div>);
  const sound = screen.getByRole('button', { name: 'A' });
  const flagged = screen.getByRole('button', { name: 'B, Repeats an earlier value' });
  expect(getComputedStyle(flagged).color).not.toBe(getComputedStyle(sound).color);
});
