import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const schema: PrefGroup = {
  name: '',
  children: {
    extra: { name: 'Extra', showIf: { path: 'snap.on' }, children: { fine: flag('Fine') } },
    snap: { name: 'Snap', children: { on: flag('Snap on') } },
  },
};

it('keeps a column mounted when a column before it appears', () => {
  const { rerender } = renderWithIcons(<PrefsForm schema={schema} values={{ snap: { on: false } }} onChange={() => {}} />);
  const before = screen.getByRole('checkbox', { name: 'Snap on' });
  rerender(<PrefsForm schema={schema} values={{ snap: { on: true } }} onChange={() => {}} />);
  expect(screen.getByRole('checkbox', { name: 'Fine' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Snap on' })).toBe(before);
});
