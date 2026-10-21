import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { ActionBar } from '../ActionBar';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

// The rule ActionBar.module.css drew before the strip moved onto Bar, restated as the oracle.
const OLD_STRIP = {
  background: 'var(--wzl-surface)',
  border: '1px solid var(--wzl-border)',
  borderRadius: 'var(--wzl-radius-sm)',
  padding: 'var(--wzl-space-1)',
};

const PROPS = [
  'background-color',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-left-width',
  'border-top-left-radius',
  'padding-top',
  'padding-left',
] as const;

const schema: PrefGroup = {
  name: 'Schema',
  children: { on: { kind: 'boolean', name: 'On', description: '', default: false } as PrefLeaf },
};

const read = (el: Element) => {
  const cs = getComputedStyle(el);
  return Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
};

it("draws ActionBar's strip, and a schema bar's, as ActionBar's own rule did", () => {
  renderWithIcons(
    <>
      <div data-testid="old" style={OLD_STRIP} />
      <ActionBar group="demo" />
      <Bar schema={schema} label="Schema" framed="segmented" />
    </>,
  );
  const want = read(screen.getByTestId('old'));
  expect(want['border-top-width']).toBe('1px');
  for (const name of ['demo actions', 'Schema']) {
    const bar = screen.getByRole('toolbar', { name });
    expect(read(bar)).toEqual(want);
    expect(getComputedStyle(bar).columnGap).toBe('1px');
    expect(getComputedStyle(bar).userSelect).toBe('none');
  }
});
