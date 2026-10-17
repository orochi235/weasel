import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { ActionsProvider, useCommand } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { PreviewPane } from './PreviewPane';

afterEach(cleanup);

function Command() {
  useCommand('file.open', 'Open', () => {});
  return null;
}

const menu = (name: string): PrefGroup => ({
  name, description: '', as: 'menu',
  children: { open: { kind: 'action', action: 'file.open', name: '', description: '', default: undefined } },
});

// Every keystroke edits the schema, and the preview remounts its menu open on each edit.
function NameField() {
  const [name, setName] = useState('File');
  return (
    <ActionsProvider>
      <Command />
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <PreviewPane schema={menu(name)} onDefaults={() => {}} />
    </ActionsProvider>
  );
}

test('a menu previewed open leaves focus in the field being typed into', async () => {
  render(<NameField />);
  const input = screen.getByRole('textbox', { name: 'Name' });
  act(() => input.focus());
  await userEvent.keyboard('er');
  expect(document.activeElement).toBe(input);
  expect((input as HTMLInputElement).value).toBe('Filer');
  expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
});
