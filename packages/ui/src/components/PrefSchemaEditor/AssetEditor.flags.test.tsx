import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AssetEditor } from './AssetEditor';
import { asset, hasRow, pickRow, structure, tool } from './AssetEditor.fixture';
import type { Workspace } from './workspace';
import { WORKSPACE } from './workspace.fixtures';
import { workspaceCodec } from './workspaceCodec';

afterEach(cleanup);

const codec = workspaceCodec([]);

/** A host that keeps the workspace, and can lock and relabel its panel as a host's own state would. */
function Host({ seen }: { seen(workspace: Workspace): void }) {
  const [workspace, setWorkspace] = useState(WORKSPACE);
  seen(workspace);
  return (
    <>
      <button type="button" onClick={() => setWorkspace((w) => ({ assets: w.assets.map((a) => (a.id === 'code' ? { ...a, readOnly: true, label: 'Code panel' } : a)) }))}>Lock the panel</button>
      <AssetEditor list workspace={workspace} codec={codec} onChange={setWorkspace} />
    </>
  );
}

describe('AssetEditor under a host that changes an asset between steps', () => {
  it('steps the roots back and forward, and leaves a lock and a label as the host has them now', () => {
    let latest: Workspace = WORKSPACE;
    render(<Host seen={(w) => { latest = w; }} />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    fireEvent.click(screen.getByRole('button', { name: 'Lock the panel' }));
    const locked = () => {
      expect(within(asset('Code panel')).getByRole('img', { name: 'Read-only' })).toBeInTheDocument();
      expect(latest.assets[1]).toMatchObject({ id: 'code', readOnly: true, label: 'Code panel' });
    };
    locked();
    fireEvent.click(tool('Undo'));
    expect(hasRow('snap')).toBe(true);
    expect(latest.assets.map((a) => a.root)).toEqual(WORKSPACE.assets.map((a) => a.root));
    locked();
    fireEvent.click(tool('Redo'));
    expect(hasRow('snap')).toBe(false);
    locked();
  });
});
