import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { AssetEditor } from './AssetEditor';
import { asset, assets, attributes, CODE, hasRow, Live, pickRow, rekey, row, SETTINGS, structure, tool, WITH_LOCKED, WORKSPACE } from './AssetEditor.fixture';
import type { Workspace } from './workspace';
import { pointer } from './workspace.fixtures';
import { workspaceCodec } from './workspaceCodec';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** A dialog holding one page under `key`, a path the panel holds a pointer at. */
const dialogWith = (key: string): Workspace['assets'][number] => ({
  id: 'settings', label: 'Settings', kind: 'schema',
  root: { name: 'Settings', children: { [key]: { name: 'Page', children: { on: { kind: 'boolean', name: 'On', description: '', default: true } } } } },
});

const literal = () => screen.getByTestId('schema-literal').textContent;
const last = (onChange: ReturnType<typeof vi.fn>): Workspace => onChange.mock.calls.at(-1)![0] as Workspace;

describe('AssetEditor asset list', () => {
  it('lists Settings under Dialogs and Code under Panels', () => {
    renderWithIcons(<Live />);
    expect(within(within(assets()).getByRole('group', { name: 'Dialogs' })).getByRole('option', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    expect(within(within(assets()).getByRole('group', { name: 'Panels' })).getByRole('option', { name: 'Code' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows the picked asset\'s rows in the structure tree, and keeps Undo as it was', () => {
    const onChange = vi.fn();
    renderWithIcons(<Live onChange={onChange} />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    onChange.mockClear();
    fireEvent.click(asset('Code'));
    expect(asset('Code')).toHaveAttribute('aria-selected', 'true');
    expect(hasRow('grid')).toBe(true);
    expect(hasRow('view')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(tool('Undo')).toBeEnabled();
    expect(tool('Redo')).toBeDisabled();
  });

  it('selects nothing in the asset picked, whatever was selected in the one left', () => {
    // Both hold a row at the path `grid`.
    const start: Workspace = { assets: [dialogWith('grid'), WORKSPACE.assets[1]!] };
    renderWithIcons(<Live start={start} />);
    pickRow('grid');
    expect(row('grid')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(asset('Code'));
    expect(row('grid')).toHaveAttribute('aria-selected', 'false');
  });

  it('shows a pointer naming the new key after its setting is re-keyed', () => {
    renderWithIcons(<Live />);
    pickRow('grid');
    rekey('lines');
    fireEvent.click(asset('Code'));
    expect(literal()).toContain('view.lines');
    expect(literal()).not.toContain('view.grid');
  });

  it('restores the setting and its pointer with one Undo, and selects the dialog the step changed', () => {
    const onChange = vi.fn();
    renderWithIcons(<Live onChange={onChange} />);
    pickRow('grid');
    rekey('lines');
    fireEvent.click(asset('Code'));
    fireEvent.click(tool('Undo'));
    expect(asset('Settings')).toHaveAttribute('aria-selected', 'true');
    expect(hasRow('grid')).toBe(true);
    expect(last(onChange).assets.map((a) => a.root)).toEqual([SETTINGS, CODE]);
    expect(tool('Undo')).toBeDisabled();
  });

  it('selects the panel a step changed, and none of the rows the dialog had selected', () => {
    const code = WORKSPACE.assets[1]!;
    const panel = { ...code, root: { ...CODE, children: { ...CODE.children, extra: pointer('view.extra') } } } as typeof code;
    const start: Workspace = { assets: [dialogWith('extra'), panel] };
    renderWithIcons(<Live start={start} />);
    fireEvent.click(asset('Code'));
    pickRow('grid');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(hasRow('grid')).toBe(false);
    // Removing a row selects the one after it.
    expect(row('snap')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(asset('Settings'));
    // The dialog's own row at the path `extra`, which the panel holds a pointer at too.
    pickRow('extra');
    fireEvent.click(tool('Undo'));
    expect(asset('Code')).toHaveAttribute('aria-selected', 'true');
    expect(row('grid')).toHaveAttribute('aria-selected', 'true');
    expect(row('extra')).toHaveAttribute('aria-selected', 'false');
    // Forward again the step leaves the panel shown, with what the removal selected, and the dialog's `extra` is not taken for the panel's.
    fireEvent.click(tool('Redo'));
    expect(asset('Code')).toHaveAttribute('aria-selected', 'true');
    expect(row('snap')).toHaveAttribute('aria-selected', 'true');
    expect(row('extra')).toHaveAttribute('aria-selected', 'false');
  });

  it('marks every asset a removal changed', () => {
    renderWithIcons(<Live />);
    expect(asset('Settings')).not.toHaveAttribute('data-changed');
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(asset('Settings')).toHaveAttribute('data-changed');
    expect(asset('Code')).toHaveAttribute('data-changed');
  });

  it('locks a read-only asset: no tool adds or removes, and no attribute takes an edit', () => {
    const onChange = vi.fn();
    renderWithIcons(<Live start={WITH_LOCKED} onChange={onChange} />);
    expect(within(asset('Layout')).getByRole('img', { name: 'Dynamic' })).toBeInTheDocument();
    expect(within(asset('Code')).queryByRole('img', { name: 'Dynamic' })).toBeNull();
    fireEvent.click(asset('Layout'));
    pickRow('rows');
    expect(row('rows')).toHaveAttribute('aria-selected', 'true');
    for (const name of ['Remove', 'Add pref', 'Add group', 'Add alias', 'Page', 'Separator']) expect(tool(name)).toBeDisabled();
    expect(within(attributes()).getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(within(attributes()).getByRole('textbox', { name: 'Key' })).toBeDisabled();
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    // An asset that takes edits has its tools back.
    fireEvent.click(asset('Code'));
    pickRow('grid');
    expect(tool('Remove')).toBeEnabled();
  });

  it('draws no list, and no pane for one, unless asked', () => {
    renderWithIcons(<AssetEditor workspace={WORKSPACE} codec={workspaceCodec([])} onChange={() => {}} />);
    expect(screen.queryByRole('listbox', { name: 'Assets' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).toBeNull();
  });
});

describe('AssetEditor over several assets', () => {
  const storage = () => {
    const held = new Map<string, string>();
    return { getItem: (k: string) => held.get(k) ?? null, setItem: (k: string, v: string) => { held.set(k, v); }, removeItem: (k: string) => { held.delete(k); }, held };
  };

  it('keeps its history under a host that makes its workspace anew each time it draws', () => {
    function Host() {
      const [roots, setRoots] = useRoots();
      const workspace: Workspace = { assets: WORKSPACE.assets.map((a, i) => ({ ...a, root: roots[i]! })) };
      return <AssetEditor list workspace={workspace} codec={workspaceCodec([])} onChange={(next) => setRoots(next.assets.map((a) => a.root))} />;
    }
    renderWithIcons(<Host />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(tool('Undo')).toBeEnabled();
    fireEvent.click(tool('Undo'));
    expect(hasRow('snap')).toBe(true);
  });

  it('keeps a draft of an edit to a panel alone, and drops it when the edit is undone', () => {
    const kept = storage();
    renderWithIcons(<Live draftKey="ws" draftStorage={kept} />);
    fireEvent.click(asset('Code'));
    pickRow('grid');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(Object.keys((JSON.parse(kept.held.get('ws')!) as { assets: object }).assets)).toEqual(['code']);
    fireEvent.click(tool('Undo'));
    expect(kept.held.has('ws')).toBe(false);
  });

  it('keeps each asset\'s folded rows apart', () => {
    // Both hold a group at the path `view`.
    const start: Workspace = { assets: [WORKSPACE.assets[0]!, { ...WORKSPACE.assets[1]!, root: { name: 'Code', children: { view: { name: 'Rows', as: 'section', children: CODE.children } } } }] };
    const view = renderWithIcons(<Live start={start} draftKey="ws" />);
    fireEvent.click(tool('Collapse all'));
    expect(hasRow('grid')).toBe(false);
    fireEvent.click(asset('Code'));
    expect(hasRow('grid')).toBe(true);
    fireEvent.click(asset('Settings'));
    expect(hasRow('grid')).toBe(false);
    view.unmount();
    renderWithIcons(<Live start={start} draftKey="ws" />);
    expect(hasRow('view')).toBe(true);
    expect(hasRow('grid')).toBe(false);
    fireEvent.click(asset('Code'));
    expect(hasRow('grid')).toBe(true);
  });
});

function useRoots() {
  return useState(WORKSPACE.assets.map((a) => a.root));
}
