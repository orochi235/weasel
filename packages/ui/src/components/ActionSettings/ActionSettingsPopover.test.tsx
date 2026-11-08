import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '../../testing/withIcons';
import { ActionSettingsPopover } from './ActionSettingsPopover';

afterEach(cleanup);

const form = {
  schema: { name: 'Snap Settings', children: { strict: { kind: 'boolean', name: 'Strict', description: '', default: false } } } as PrefGroup,
  values: { strict: true },
  mixed: new Set<string>(),
  onChange: () => {},
};

it('stays shut when an action disabled while its form is open comes back', () => {
  const { rerender } = renderWithIcons(<ActionSettingsPopover form={form} label="Snap" />);
  fireEvent.click(screen.getByRole('button', { name: 'Snap' }));
  expect(screen.getByRole('dialog', { name: 'Snap Settings' })).toBeInTheDocument();
  rerender(<ActionSettingsPopover form={form} label="Snap" disabled />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<ActionSettingsPopover form={form} label="Snap" />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
