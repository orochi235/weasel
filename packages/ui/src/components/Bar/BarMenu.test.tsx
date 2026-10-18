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

  it('leaves focus in another menu when a menu that opened itself closes', async () => {
    await renderSettled(
      <ActionsProvider>
        <Command />
        <BarMenu label="File" schema={FILE} values={() => undefined} defaultOpen />
        <div role="menu" tabIndex={-1} aria-label="Other" />
      </ActionsProvider>,
    );
    const other = screen.getByRole('menu', { name: 'Other' });
    act(() => other.focus());
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(screen.queryByRole('menuitem', { name: 'Open' })).toBeNull();
    expect(document.activeElement).toBe(other);
  });

  it('takes focus back when focus is in its own submenu as it closes', async () => {
    const NESTED: PrefGroup = {
      name: 'File', description: '', as: 'menu',
      children: { more: { name: 'More', description: '', as: 'menu', children: FILE.children } },
    };
    await renderSettled(<ActionsProvider><Command /><BarMenu label="File" schema={NESTED} values={() => undefined} defaultOpen /></ActionsProvider>);
    act(() => { fireEvent.click(screen.getByRole('menuitem', { name: /^More/ })); });
    const sub = screen.getAllByRole('menu').at(-1)!;
    act(() => sub.focus());
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /File/ }));
  });
});

