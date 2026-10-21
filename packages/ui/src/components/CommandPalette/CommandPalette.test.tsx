import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { Profiler, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, ActionsProvider, useAction } from '@weasel-js/core';
import { CommandPalette } from './CommandPalette';

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
    tags: ['container', 'structure'],
    invoker: { timing: 'immediate' as const, run: () => { runs.group(); } },
  });
  return null;
}

function Sizes() {
  useAction({
    id: 'new',
    label: 'New',
    variants: [{ key: 'a4', label: 'A4', params: { size: 'a4' } }, { key: 'legal', label: 'Legal', params: { size: 'legal' } }],
    invoker: { timing: 'immediate' as const, run: () => {} },
  });
  return null;
}

function Harness({ sizes = false }: { sizes?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <ActionsProvider>
      <Actions />
      {sizes && <Sizes />}
      <button type="button" onClick={() => setOpen(true)}>open</button>
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
const openPalette = (sizes = false) => {
  renderWithIcons(<Harness sizes={sizes} />);
  fireEvent.click(screen.getByText('open'));
};
const flush = () => act(async () => { await Promise.resolve(); });

describe('CommandPalette', () => {
  it('titles a variant with its action, and a search for the action finds it by label', () => {
    openPalette(true);
    fireEvent.change(search(), { target: { value: 'new' } });
    expect(options().map((o) => o.textContent)).toEqual(['New: A4', 'New: Legal']);
  });

  it('tells assistive tech which action Enter will run, as the highlight moves', () => {
    openPalette();
    const input = screen.getByRole('combobox', { name: 'Search actions' });
    const list = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(input.getAttribute('aria-activedescendant')).toBe(selected()!.id);
    const first = selected()!.id;
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(selected()!.id).not.toBe(first);
    expect(input.getAttribute('aria-activedescendant')).toBe(selected()!.id);
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

  it('finds an action by a tag, and names the tag only on a row the tag alone found', () => {
    openPalette();
    fireEvent.change(search(), { target: { value: 'STRUCT' } });
    expect(options()).toHaveLength(1);
    expect(within(options()[0]).getByText('Group')).toBeTruthy();
    expect(within(options()[0]).getByText('structure')).toBeTruthy();
    fireEvent.change(search(), { target: { value: 'gro' } });
    expect(options()[0].textContent).toBe('Group');
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

  it('shows a reason written as text as it is', () => {
    function Full() {
      useAction({
        id: 'full',
        label: 'Add another',
        enabled: () => 'At most 8 at once',
        invoker: { timing: 'immediate' as const, run: () => {} },
      });
      return null;
    }
    function FullHarness() {
      const [open, setOpen] = useState(false);
      return (
        <ActionsProvider>
          <Full />
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <CommandPalette open={open} onClose={() => setOpen(false)} />
        </ActionsProvider>
      );
    }
    renderWithIcons(<FullHarness />);
    fireEvent.click(screen.getByText('open'));
    const row = options().find((o) => o.textContent?.includes('Add another'))!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('At most 8 at once');
  });

  it('opens on the first enabled row, so Enter runs something', async () => {
    const run = vi.fn();
    function DisabledFirst() {
      useAction({
        id: 'delete',
        label: 'Delete',
        enabled: () => ActionDisabledReason.SelectionRequired,
        invoker: { timing: 'immediate' as const, run: () => {} },
      });
      useAction({ id: 'group', label: 'Group', invoker: { timing: 'immediate' as const, run } });
      return null;
    }
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <ActionsProvider>
          <DisabledFirst />
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <CommandPalette open={open} onClose={() => setOpen(false)} />
        </ActionsProvider>
      );
    }
    renderWithIcons(<Host />);
    fireEvent.click(screen.getByText('open'));
    expect(selected()!.textContent).toBe('Group');
    fireEvent.keyDown(search(), { key: 'Enter' });
    await flush();
    expect(run).toHaveBeenCalledOnce();
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
    fireEvent.click(screen.getByText('open'));
    expect((search() as HTMLInputElement).value).toBe('');
    expect(selected()!.textContent).toBe(options()[0].textContent);
  });

  it('never commits a reopened palette still holding the last search', () => {
    const seen: string[] = [];
    renderWithIcons(
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
    fireEvent.click(screen.getByText('open'));
    fireEvent.change(search(), { target: { value: 'gro' } });
    fireEvent.keyDown(search(), { key: 'Escape' });
    seen.length = 0;
    fireEvent.click(screen.getByText('open'));
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
