import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, ActionsProvider, useAction } from '@weasel-js/core';
import { CommandPalette, useCommandPaletteShortcut } from '../CommandPalette/CommandPalette';

afterEach(cleanup);
// jsdom has no layout, so no scrollIntoView; the palette calls it on every highlight.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const runs = { duplicate: vi.fn(), delete: vi.fn(), group: vi.fn() };

function Actions() {
  useAction({
    id: 'duplicate',
    label: 'Duplicate',
    defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
    invoker: { timing: 'immediate' as const, run: () => { runs.duplicate(); } },
  });
  useAction({
    id: 'delete',
    label: 'Delete',
    enabled: () => ActionDisabledReason.SelectionRequired,
    invoker: { timing: 'immediate' as const, run: () => { runs.delete(); } },
  });
  useAction({
    id: 'group',
    label: 'Group',
    invoker: { timing: 'immediate' as const, run: () => { runs.group(); } },
  });
  return null;
}

function Harness() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(open, setOpen);
  return (
    <ActionsProvider>
      <Actions />
      <input aria-label="elsewhere" />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </ActionsProvider>
  );
}

const palette = () => screen.queryByRole('dialog');
const search = () => screen.getByPlaceholderText('Search actions…');
const options = () => screen.getAllByRole('option');
const selected = () => options().find((o) => o.getAttribute('aria-selected') === 'true');
// The palette snapshots the registry when it opens, so open it the way a
// user does: after the actions have registered.
const openPalette = () => {
  render(<Harness />);
  fireEvent.keyDown(document.body, { key: '/' });
};
const flush = () => act(async () => { await Promise.resolve(); });

describe('CommandPalette', () => {
  it('opens on / and not while typing in a field', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByLabelText('elsewhere'), { key: '/' });
    expect(palette()).toBeNull();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(palette()).not.toBeNull();
  });

  it('is a titled dialog', () => {
    openPalette();
    expect(screen.getByRole('dialog', { name: 'Commands' })).toBeTruthy();
  });

  it('lists every action and filters by label', () => {
    openPalette();
    expect(options().map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Duplicate'), expect.stringContaining('Delete'), expect.stringContaining('Group')]),
    );
    fireEvent.change(search(), { target: { value: 'gro' } });
    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain('Group');
    fireEvent.change(search(), { target: { value: 'zzz' } });
    expect(screen.getByText('No matching actions.')).toBeTruthy();
  });

  it('draws a shortcut as keycaps', () => {
    openPalette();
    const row = options().find((o) => o.textContent?.includes('Duplicate'))!;
    const caps = row.querySelectorAll('kbd[data-kind]');
    expect(caps.length).toBeGreaterThan(0);
    expect(within(row).getByText('D')).toBeTruthy();
  });

  it('shows why a disabled action is disabled', () => {
    openPalette();
    const row = options().find((o) => o.textContent?.includes('Delete'))!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('Selection required');
  });

  it('moves the highlight with the arrows, skipping disabled rows', () => {
    openPalette();
    const labels = options().map((o) => o.textContent ?? '');
    const enabled = labels.filter((l) => !l.includes('Delete'));
    expect(selected()!.textContent).toBe(labels[0]);
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(selected()!.textContent).toBe(enabled[1]);
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(selected()!.textContent).toBe(enabled[0]);
    fireEvent.keyDown(search(), { key: 'ArrowUp' });
    expect(selected()!.textContent).toBe(enabled[1]);
  });

  it('runs the highlighted action on Enter and closes', async () => {
    runs.group.mockClear();
    openPalette();
    fireEvent.change(search(), { target: { value: 'group' } });
    fireEvent.keyDown(search(), { key: 'Enter' });
    await flush();
    expect(runs.group).toHaveBeenCalledOnce();
    expect(palette()).toBeNull();
  });

  it('reopens with an empty search and the first row highlighted', () => {
    openPalette();
    fireEvent.change(search(), { target: { value: 'gro' } });
    fireEvent.keyDown(search(), { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: '/' });
    expect((search() as HTMLInputElement).value).toBe('');
    expect(selected()!.textContent).toBe(options()[0].textContent);
  });

  it('never commits a reopened palette still holding the last search', () => {
    const seen: string[] = [];
    render(
      <Profiler
        id="palette"
        onRender={() => {
          const input = screen.queryByPlaceholderText<HTMLInputElement>('Search actions…');
          if (input) seen.push(input.value);
        }}
      >
        <Harness />
      </Profiler>,
    );
    fireEvent.keyDown(document.body, { key: '/' });
    fireEvent.change(search(), { target: { value: 'gro' } });
    fireEvent.keyDown(search(), { key: 'Escape' });
    seen.length = 0;
    fireEvent.keyDown(document.body, { key: '/' });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === '')).toBe(true);
  });

  it('closes on Escape without running anything', () => {
    runs.duplicate.mockClear();
    openPalette();
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(palette()).toBeNull();
    expect(runs.duplicate).not.toHaveBeenCalled();
  });
});
