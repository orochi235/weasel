import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
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

  it('shows a tooltip from its description, and still opens its menu on click', async () => {
    await renderSettled(<ActionsProvider><Command /><BarMenu label="File" description="File commands" schema={FILE} values={() => undefined} /></ActionsProvider>);
    const trigger = screen.getByRole('button', { name: /File/ });
    // React Aria opens a tooltip only on focus-visible, which keyboard modality grants.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => trigger.focus());
    expect(screen.getByRole('tooltip').textContent).toContain('File commands');
    act(() => { fireEvent.click(trigger); });
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
  });
});
