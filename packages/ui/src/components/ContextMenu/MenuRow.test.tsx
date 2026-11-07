import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuEntry } from '@weasel-js/menu';
import { ActionDisabledReason } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';
import { REST_MS } from '../Tree/useRowTip';
import { OpenPanels } from './ContextMenuHost';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function open(entries: MenuEntry[]) {
  render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'keyboard' }} close={() => {}} />);
  return screen.getByRole('menu');
}

const shortcut = { key: 'd', mod: true };
const run = () => {};

describe('a disabled item row in a DOM menu', () => {
  it('keeps its shortcut, and gives assistive tech its reason as its description', () => {
    open([
      { kind: 'item', key: 'dup', label: 'Duplicate', shortcut, disabled: true, disabledReason: 'Select something first', run },
      { kind: 'item', key: 'paste', label: 'Paste', disabled: true, disabledReason: ActionDisabledReason.NotApplicable, run },
    ]);
    const dup = screen.getByRole('menuitem', { name: /Duplicate/ });
    expect(dup).toHaveAttribute('aria-description', 'Select something first');
    expect(dup.textContent).toContain(formatShortcut(shortcut));
    expect(dup.textContent).not.toContain('Select something first');
    expect(screen.getByRole('menuitem', { name: /Paste/ })).toHaveAttribute('aria-description', 'Not applicable here');
  });

  it('says why in a tooltip once the highlight rests on it', () => {
    vi.useFakeTimers();
    const menu = open([
      { kind: 'item', key: 'cut', label: 'Cut', run },
      { kind: 'item', key: 'dup', label: 'Duplicate', shortcut, disabled: true, disabledReason: 'Select something first', run },
    ]);
    const dup = screen.getByRole('menuitem', { name: /Duplicate/ });
    for (let i = 0; i < 2 && menu.getAttribute('aria-activedescendant') !== dup.id; i++) {
      act(() => { fireEvent.keyDown(menu, { key: 'ArrowDown' }); });
    }
    expect(menu.getAttribute('aria-activedescendant')).toBe(dup.id);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(REST_MS); });
    expect(screen.getByRole('tooltip').textContent).toContain('Select something first');
  });

  it('has nothing to say while enabled, whatever reason it carries', () => {
    open([{ kind: 'item', key: 'dup', label: 'Duplicate', shortcut, disabledReason: 'stale', run }]);
    const dup = screen.getByRole('menuitem', { name: /Duplicate/ });
    expect(dup).not.toHaveAttribute('aria-description');
    expect(dup.textContent).not.toContain('stale');
  });
});
