import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { AssetEditor } from './AssetEditor';
import { type Workspace, workspaceCodec } from '@weasel-js/prefs/edit';
import { SETTINGS } from '@weasel-js/prefs/testing/editWorkspace';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

const codec = workspaceCodec([]);
const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(key).closest('[role="treeitem"]')!;

function Live({ start, onChange }: { start: Workspace; onChange(next: Workspace): void }) {
  const [workspace, setWorkspace] = useState(start);
  return <AssetEditor workspace={workspace} codec={codec} onChange={(next) => { onChange(next); setWorkspace(next); }} />;
}

describe('AssetEditor', () => {
  it('removes nothing from a read-only asset, and leaves the selection where it was', () => {
    const onChange = vi.fn();
    renderWithIcons(<Live start={{ assets: [{ id: 'settings', label: 'Settings', kind: 'schema', root: SETTINGS, readOnly: true }] }} onChange={onChange} />);
    fireEvent.click(within(structure()).getByText('snap'));
    // What a reader sees of it: the tool that removes is off, with a row selected to remove.
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    expect(row('snap')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('removes the selected setting from an asset that takes edits', () => {
    const onChange = vi.fn();
    renderWithIcons(<Live start={{ assets: [{ id: 'settings', label: 'Settings', kind: 'schema', root: SETTINGS }] }} onChange={onChange} />);
    fireEvent.click(within(structure()).getByText('snap'));
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(within(structure()).queryByText('snap')).toBeNull();
  });
});
