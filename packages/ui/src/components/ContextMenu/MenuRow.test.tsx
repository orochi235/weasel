import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MenuEntry } from '@weasel-js/menu';
import { ActionDisabledReason } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';
import { OpenPanels } from './ContextMenuHost';

afterEach(cleanup);

function open(entries: MenuEntry[]) {
  render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'keyboard' }} close={() => {}} />);
}

const shortcut = { key: 'd', mod: true };

describe('a disabled item row in a DOM menu', () => {
  it('says why in place of its shortcut, and to assistive tech as its description', () => {
    open([
      { kind: 'item', key: 'dup', label: 'Duplicate', shortcut, disabled: true, disabledReason: 'Select something first', run: () => {} },
      { kind: 'item', key: 'paste', label: 'Paste', disabled: true, disabledReason: ActionDisabledReason.NotApplicable, run: () => {} },
    ]);
    const dup = screen.getByRole('menuitem', { name: /Duplicate/ });
    expect(dup).toHaveAttribute('aria-description', 'Select something first');
    expect(dup.textContent).toContain('Select something first');
    expect(dup.textContent).not.toContain(formatShortcut(shortcut));
    expect(screen.getByRole('menuitem', { name: /Paste/ }).textContent).toContain('Not applicable here');
  });

  it('keeps its shortcut when enabled, whatever reason it carries', () => {
    open([{ kind: 'item', key: 'dup', label: 'Duplicate', shortcut, disabledReason: 'stale', run: () => {} }]);
    const dup = screen.getByRole('menuitem', { name: /Duplicate/ });
    expect(dup).not.toHaveAttribute('aria-description');
    expect(dup.textContent).not.toContain('stale');
  });
});
