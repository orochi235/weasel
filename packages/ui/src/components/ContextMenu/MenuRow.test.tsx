import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuEntry, MenuGrade } from '@weasel-js/menu';
import type { Grade } from '@weasel-js/theme';
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

describe('an item row\'s shortcut text', () => {
  it('prints a string shortcut as written', () => {
    open([{ kind: 'item', key: 'lock', label: 'Lock', shortcut: 'Hold L', run }]);
    expect(screen.getByRole('menuitem', { name: /Lock/ }).textContent).toContain('Hold L');
  });
});

describe('a row hint and grade in a DOM menu', () => {
  it('reads its description as its description, and its disabled reason over it', () => {
    open([
      { kind: 'item', key: 'del', label: 'Delete', description: 'Remove the selection', run },
      { kind: 'item', key: 'cut', label: 'Cut', description: 'Move it to the clipboard', disabled: true, disabledReason: 'Nothing selected', run },
      { kind: 'submenu', key: 'size', label: 'Size', description: 'Set the size', entries: [] },
    ]);
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute('aria-description', 'Remove the selection');
    expect(screen.getByRole('menuitem', { name: /Cut/ })).toHaveAttribute('aria-description', 'Nothing selected');
    expect(screen.getByRole('menuitem', { name: /Size/ })).toHaveAttribute('aria-description', 'Set the size');
  });

  it('says why a disabled value row or submenu cannot be chosen', () => {
    open([
      { kind: 'number', key: 'w', label: 'Width', value: 3, disabled: true, disabledReason: 'Locked', set: () => {} },
      { kind: 'submenu', key: 's', label: 'More', disabled: true, disabledReason: ActionDisabledReason.NotApplicable, entries: [] },
    ]);
    expect(screen.getByRole('menuitem', { name: /Width/ })).toHaveAttribute('aria-description', 'Locked');
    expect(screen.getByRole('menuitem', { name: /More/ })).toHaveAttribute('aria-description', 'Not applicable here');
  });

  it('carries its grade', () => {
    open([
      { kind: 'item', key: 'del', label: 'Delete', grade: 'danger', run },
      { kind: 'item', key: 'cut', label: 'Cut', run },
    ]);
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute('data-grade', 'danger');
    expect(screen.getByRole('menuitem', { name: /Cut/ })).not.toHaveAttribute('data-grade');
  });

  it('takes the grades the theme has, since the menu model cannot depend on it', () => {
    expectTypeOf<MenuGrade>().toEqualTypeOf<Grade>();
  });
});
