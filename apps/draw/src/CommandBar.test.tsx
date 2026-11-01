import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, useCommand } from '@weasel-js/core';
import { EditorShell } from '@weasel-js/editor';
import { createMemoryAdapter } from '@weasel-js/storage';
import { DRAW_PREFERENCES_COMMAND } from './appCommands/actions';
import { CommandBar } from './CommandBar';
import { DEBUG_MENU, DEV_ROUTES, useDebugCommands } from './dev/devRoutes';
import { PAPER_SIZES } from './paperSizes';
import { PREFS } from './prefs';
import { withIcons } from './testIcons';

const newRun = vi.fn();
const openRun = vi.fn();
const importRun = vi.fn();
const saveRun = vi.fn();

function FileStubs() {
  useCommand('file.new', 'New', newRun, {
    variants: PAPER_SIZES.map(({ key, label }) => ({ key, label, params: { size: key } })),
  });
  useCommand('file.open', 'Open…', openRun);
  useCommand('file.import', 'Import…', importRun);
  useCommand('file.save', 'Save', saveRun);
  return null;
}

function DebugStubs() {
  useDebugCommands();
  return null;
}

function renderBar() {
  render(
    <ActionsProvider>
      <FileStubs />
      <CommandBar />
    </ActionsProvider>,
  );
}

function openMenu(name: RegExp) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('CommandBar', () => {
  it('leaves New to the File menu', () => {
    renderBar();
    expect(screen.queryByRole('button', { name: /New/ })).toBeNull();
  });

  it('opens, imports and saves from their own buttons', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    expect(importRun).toHaveBeenCalledTimes(1);
    expect(openRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open…' }));
    expect(openRun).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveRun).toHaveBeenCalledTimes(1);
  });

  it('draws the menus slot first in its row, ahead of the File buttons', () => {
    render(<CommandBar menus={<div role="menubar" aria-label="Menu bar" />} />);
    const row = screen.getByRole('toolbar', { name: 'Actions' });
    expect(row.firstElementChild).toBe(screen.getByRole('menubar', { name: 'Menu bar' }));
  });

  it("draws the shell's Preferences in the App run ahead of Commands, and opens the dialog from it", () => {
    function Commands() {
      useCommand('app.commands', 'Commands', vi.fn());
      return null;
    }
    render(
      <EditorShell
        prefs={{ schema: PREFS, storage: createMemoryAdapter(new Map()), prefix: 'test.prefs/' }}
        preferences={DRAW_PREFERENCES_COMMAND}
      >
        <Commands />
        <CommandBar />
      </EditorShell>,
      { wrapper: withIcons },
    );
    const prefs = screen.getByRole('button', { name: 'Preferences' });
    const commands = screen.getByRole('button', { name: 'Commands' });
    expect(prefs.compareDocumentPosition(commands) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => { fireEvent.click(prefs); });
    expect(screen.getByRole('dialog', { name: PREFS.name })).toBeTruthy();
  });

  it('draws Debug from the debug.open action, one row per dev route', () => {
    expect(Object.values(DEBUG_MENU.children)).toEqual([expect.objectContaining({ kind: 'action', action: 'debug.open' })]);
  });

  it.each(DEV_ROUTES)('opens $label in a new tab from the Debug menu', ({ href, label }) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <ActionsProvider>
        <DebugStubs />
        <CommandBar />
      </ActionsProvider>,
    );
    openMenu(/Debug/);
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    expect(open).toHaveBeenCalledWith(`${window.location.pathname}${window.location.search}${href}`, '_blank', 'noopener');
  });
});
