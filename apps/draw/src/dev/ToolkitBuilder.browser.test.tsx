import '@weasel-js/theme/tokens.css';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { ActionsProvider, AmbientContributionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { devtools } from '@weasel-js/devtools/hook';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ToolkitBuilder } from './ToolkitBuilder';
import { renderWithIcons } from '../testIcons';

// The preset switches wrap across the header, so which ones a drag crosses only real layout answers.

beforeEach(async () => {
  await page.viewport(1280, 800);
  window.history.replaceState(null, '', '#/dev/toolkits?base=draw&tools=');
});
afterEach(cleanup);

test('a drag across the preset switches turns off each one it crosses, from an on one', async () => {
  renderWithIcons(
    <DepRegistryProvider>
      <ActionsProvider>
        <SelectionContextProvider>
          <AmbientContributionsProvider contributions={[devtools]}>
            <ToolkitBuilder />
          </AmbientContributionsProvider>
        </SelectionContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  const presets = within(screen.getByRole('group', { name: 'Presets' })).getAllByRole('switch') as HTMLInputElement[];
  const paths = presets.findIndex((p) => p.closest('[data-sweep-index]')?.textContent === 'path-tools');
  expect(presets.map((p) => p.checked).slice(paths)).toEqual([true, true]);
  sweepAcross(presets.slice(paths));
  await waitFor(() => expect(window.location.hash).toBe('#/dev/toolkits?base=draw&tools=&paths=0&text=0'));
});
