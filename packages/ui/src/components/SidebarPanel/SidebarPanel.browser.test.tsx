import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';

// Where the header's controls sit is layout, which jsdom does not do.

afterEach(cleanup);

describe('SidebarPanel header', () => {
  it('packs its controls at the trailing edge when it has no title', () => {
    render(
      <div style={{ width: 300 }}>
        <SidebarPanel actions={<button type="button">act</button>} onHide={() => {}}>body</SidebarPanel>
      </div>,
    );
    const act = screen.getByRole('button', { name: 'act' }).getBoundingClientRect();
    const hide = screen.getByRole('button', { name: 'Hide panel' }).getBoundingClientRect();
    const row = screen.getByRole('button', { name: 'act' }).parentElement!.parentElement!.getBoundingClientRect();
    expect(act.left).toBeGreaterThan(row.left + row.width / 2);
    expect(hide.left - act.right).toBeLessThan(24);
  });
});
