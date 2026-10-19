import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, useCommand } from '@weasel-js/core';
import { CommandBar } from './CommandBar';
import { PAPER_SIZES } from './paperSizes';

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
  it('starts a new document at the paper size picked from New', () => {
    renderBar();
    openMenu(/New/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'A4' }));
    expect(newRun).toHaveBeenCalledWith({ size: 'a4' });
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

  it('opens a debug surface in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<CommandBar />);
    openMenu(/Debug/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bundle Inspector' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/#\/dev\/registry$/), '_blank', 'noopener');
  });
});
