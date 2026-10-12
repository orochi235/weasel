import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { asset, attributes, Live, pickRow, row, SETTINGS, structure, tool, WITH_LOCKED, WORKSPACE } from './AssetEditor.fixture';
import { addNode, removeNode } from './schemaEdit';
import type { Workspace } from './workspace';
import { pointer } from './workspace.fixtures';

afterEach(cleanup);

const preview = () => screen.getByRole('region', { name: 'Live preview' });

describe('AssetEditor on a layout', () => {
  it('previews a panel\'s pointers as the settings they name in its dialog', () => {
    render(<Live />);
    fireEvent.click(asset('Code'));
    expect(within(preview()).getByRole('checkbox', { name: 'Show grid' })).toBeChecked();
    expect(within(preview()).getByRole('checkbox', { name: 'Snap' })).not.toBeChecked();
  });

  it('ignores a value set in a panel\'s preview, where one set in a dialog\'s is its setting\'s default', () => {
    const onChange = vi.fn();
    render(<Live onChange={onChange} />);
    fireEvent.click(asset('Code'));
    fireEvent.click(within(preview()).getByRole('checkbox', { name: 'Show grid' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(tool('Undo')).toBeDisabled();
    fireEvent.click(asset('Settings'));
    fireEvent.click(within(preview()).getByRole('checkbox', { name: 'Show grid' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('offers a pointer where it points and nothing else, from the settings of its dialog', () => {
    render(<Live />);
    fireEvent.click(asset('Code'));
    pickRow('grid');
    expect(within(attributes()).getByText('Of')).toBeInTheDocument();
    // The setting it names, as the dialog names it.
    expect(within(attributes()).getAllByText('Show grid (view.grid)').length).toBeGreaterThan(0);
    for (const name of ['Name', 'Key', 'Description']) expect(within(attributes()).queryByRole('textbox', { name })).toBeNull();
    expect(within(attributes()).queryByText('Kind')).toBeNull();
  });

  it('goes on offering an alias in a dialog its name and its key', () => {
    const start: Workspace = { assets: [{ ...WORKSPACE.assets[0]!, root: addNode(SETTINGS, 'view', 'again', pointer('view.grid')) }] };
    render(<Live start={start} />);
    pickRow('again');
    expect(within(attributes()).getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(within(attributes()).getByRole('textbox', { name: 'Key' })).toBeInTheDocument();
  });

  it('asks the host for a pointer\'s mark by the setting it names, and for no other row of a layout', () => {
    const asked: string[] = [];
    const start: Workspace = { assets: [WORKSPACE.assets[0]!, { ...WORKSPACE.assets[1]!, root: { name: 'Code', children: { shown: pointer('view.grid'), rows: { name: 'Rows', as: 'section', children: { snap: pointer('view.snap') } } } } }] };
    render(<Live start={start} rowMark={(path) => { asked.push(path); return <span>mark of {path}</span>; }} />);
    asked.length = 0;
    fireEvent.click(asset('Code'));
    expect(within(row('shown')).getByText('mark of view.grid')).toBeInTheDocument();
    expect(within(row('snap')).getByText('mark of view.snap')).toBeInTheDocument();
    expect(new Set(asked)).toEqual(new Set(['view.grid', 'view.snap']));
  });

  it('marks a pointer that names no setting in its dialog', () => {
    render(<Live start={WITH_LOCKED} />);
    fireEvent.click(asset('Layout'));
    expect(within(row('gone')).getByText('no setting')).toBeInTheDocument();
    expect(within(row('snap')).queryByText('no setting')).toBeNull();
    fireEvent.click(asset('Settings'));
    expect(within(structure()).queryByText('no setting')).toBeNull();
  });

  it('marks a pointer a draft reopens with after its setting left the source', () => {
    const held = new Map<string, string>();
    const storage = { getItem: (k: string) => held.get(k) ?? null, setItem: (k: string, v: string) => { held.set(k, v); }, removeItem: (k: string) => { held.delete(k); } };
    const first = render(<Live draftKey="ws" draftStorage={storage} />);
    fireEvent.click(asset('Code'));
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    first.unmount();
    // The source's dialog no longer holds the setting the draft's remaining pointer names.
    const source: Workspace = { assets: [{ ...WORKSPACE.assets[0]!, root: removeNode(WORKSPACE.assets[0]!.root, 'view/grid') }, WORKSPACE.assets[1]!] };
    render(<Live start={source} draftKey="ws" draftStorage={storage} />);
    fireEvent.click(asset('Code'));
    expect(within(row('grid')).getByText('no setting')).toBeInTheDocument();
  });
});
