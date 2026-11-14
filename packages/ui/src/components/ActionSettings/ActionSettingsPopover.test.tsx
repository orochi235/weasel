import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { ActionsProvider, type Action, type ActionItem } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '../../testing/withIcons';
import { ActionSettingsPopover } from './ActionSettingsPopover';
import { useActionSettings } from './useActionSettings';

afterEach(cleanup);

const form = {
  schema: { name: 'Snap Settings', children: { strict: { kind: 'boolean', name: 'Strict', description: '', default: false } } } as PrefGroup,
  values: { strict: true },
  mixed: new Set<string>(),
  onChange: () => {},
};

it('stays shut when an action disabled while its form is open comes back', () => {
  const { rerender } = renderWithIcons(<ActionSettingsPopover settings={form} label="Snap" />);
  fireEvent.click(screen.getByRole('button', { name: 'Snap' }));
  expect(screen.getByRole('dialog', { name: 'Snap Settings' })).toBeInTheDocument();
  rerender(<ActionSettingsPopover settings={form} label="Snap" disabled />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<ActionSettingsPopover settings={form} label="Snap" />);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('hands the form the values read returns, Infinity included', () => {
  const action = {
    id: 'a', label: 'A', invoker: { timing: 'immediate', run: () => {} },
    settings: { schema: form.schema, read: () => ({ values: { n: Infinity, strict: true } }) },
  } as unknown as Action;
  const { result } = renderHook(() => useActionSettings({ action } as ActionItem), {
    wrapper: ({ children }) => <ActionsProvider>{children}</ActionsProvider>,
  });
  expect(result.current?.values.n).toBe(Infinity);
});
