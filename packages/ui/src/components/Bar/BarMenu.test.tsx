import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { ActionsProvider, useCommand } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { BarMenu } from './BarMenu';

afterEach(cleanup);

const FILE: PrefGroup = {
  name: 'File', description: '', as: 'menu',
  children: { open: { kind: 'action', action: 'file.open', name: '', description: '', default: undefined } },
};

function Command() {
  useCommand('file.open', 'Open', () => {});
  return null;
}

describe('BarMenu', () => {
  it('opens on mount with defaultOpen', async () => {
    await renderSettled(<ActionsProvider><Command /><BarMenu label="File" schema={FILE} values={() => undefined} defaultOpen /></ActionsProvider>);
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
  });

  it('opens with defaultOpen when its command registers after it mounts', async () => {
    await renderSettled(<ActionsProvider><BarMenu label="File" schema={FILE} values={() => undefined} defaultOpen /><Command /></ActionsProvider>);
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
  });
});
