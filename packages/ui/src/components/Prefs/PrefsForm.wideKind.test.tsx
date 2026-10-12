import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm, type PrefRenderer } from './PrefsForm';

afterEach(cleanup);

const schema: PrefGroup = {
  name: '',
  children: { when: { kind: 'condition', name: 'Shown if', description: '', default: undefined } as PrefLeaf, size: { kind: 'number', name: 'Size', description: '', default: 1 } },
};
const draw: PrefRenderer = () => <output>a condition</output>;
const slot = (text: string): Element => screen.getByText(text).closest('[data-pref-path]')!;

// The row's layout is the stylesheet's; here, only that a kind's ask reaches the slot that spans the pane.
it('marks the row of a kind whose renderer asks for the whole width as one that spans, and no other', () => {
  const { rerender } = render(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={{ condition: draw }} />);
  expect(slot('a condition')).not.toHaveAttribute('data-wide');
  rerender(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={{ condition: Object.assign<PrefRenderer, { wide: boolean }>(() => <output>a condition</output>, { wide: true }) }} />);
  expect(slot('a condition')).toHaveAttribute('data-wide');
  expect(slot('Size')).not.toHaveAttribute('data-wide');
});
