import { createMemoryAdapter } from '@weasel-js/labkit';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShellConfig } from '../config';
import type { IndexEntry } from '../story/types';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const config: ShellConfig = {
  globals: {
    mode: {
      label: 'Mode',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Auto (OS)' },
        { value: 'dark', label: 'Dark' },
      ],
    },
  },
};

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('GlobalsToolbar', () => {
  it('sets a global from a weasel-ui select, not a native one', async () => {
    render(<Workshop index={[a]} frameUrl="/frame.html" config={config} storage={createMemoryAdapter()} />);
    const toolbar = within(await screen.findByRole('toolbar', { name: 'Globals' }));
    expect(toolbar.queryByRole('combobox')).toBeNull();
    const trigger = toolbar.getByRole('button', { name: /Mode/ });
    expect(trigger).toHaveTextContent('Auto (OS)');
    act(() => {
      fireEvent.click(trigger);
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Dark' }));
    await waitFor(() => expect(toolbar.getByRole('button', { name: /Mode/ })).toHaveTextContent('Dark'));
  });
});
