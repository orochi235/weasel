import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AssetEditor } from './AssetEditor';
import { asset, Live, pickRow, rekey, SETTINGS, structure, WORKSPACE } from './AssetEditor.fixture';
import { removeNode } from './schemaEdit';
import { diffSchemas, formatChanges, printSchema } from './schemaExport';
import type { SentAsset } from './useAssetChanges';
import type { Workspace } from './workspace';
import { workspaceCodec } from './workspaceCodec';

afterEach(cleanup);

/** The export, turned to its Changes tab. */
const changes = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
  return screen.getByRole('region', { name: 'Export' });
};
const listed = () => within(changes()).getByRole('tabpanel', { name: 'Changes' }).querySelector('pre')!.textContent.split('\n');
const submit = () => within(changes()).getByRole('button', { name: /Submit|Sending|Sent|Failed/ });

describe('AssetEditor changes', () => {
  it('lists every changed asset\'s changes under its label, whichever asset is shown', () => {
    render(<Live />);
    expect(listed()).toEqual(['No changes.']);
    pickRow('grid');
    rekey('lines');
    const both = listed();
    expect(both.indexOf('Settings')).toBe(0);
    expect(both.indexOf('Code')).toBeGreaterThan(1);
    expect(both.slice(both.indexOf('Code') + 1).join('\n')).toContain('view.lines');
    fireEvent.click(asset('Code'));
    expect(listed()).toEqual(both);
  });

  it('lists one asset\'s changes as they were before there were assets', () => {
    const one: Workspace = { assets: [WORKSPACE.assets[0]!] };
    render(<Live start={one} />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(listed().join('\n')).toBe(formatChanges(diffSchemas(SETTINGS, removeNode(SETTINGS, 'view/snap'))));
  });

  it('submits every changed asset in the workspace\'s order, each with its literal', async () => {
    const onSubmit = vi.fn<(assets: readonly SentAsset[]) => void>();
    const onChange = vi.fn<(next: Workspace) => void>();
    render(<Live onSubmit={onSubmit} onChange={onChange} />);
    expect(submit()).toBeDisabled();
    pickRow('grid');
    rekey('lines');
    fireEvent.click(asset('Code'));
    await act(async () => { fireEvent.click(submit()); });
    const now = onChange.mock.calls.at(-1)![0];
    const sent = onSubmit.mock.calls[0]![0];
    expect(sent.map((a) => [a.id, a.kind])).toEqual([['settings', 'schema'], ['code', 'layout']]);
    expect(sent.map((a) => a.literal)).toEqual(now.assets.map((a) => printSchema(a.root)));
    expect(sent.map((a) => a.changes)).toEqual(now.assets.map((a, i) => diffSchemas(WORKSPACE.assets[i]!.root, a.root)));
    expect(sent.every((a) => a.changes.length > 0)).toBe(true);
  });

  it('submits a change to an asset that is not the one shown, and leaves an unchanged asset out', async () => {
    const onSubmit = vi.fn<(assets: readonly SentAsset[]) => void>();
    render(<Live onSubmit={onSubmit} />);
    fireEvent.click(asset('Code'));
    pickRow('grid');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    fireEvent.click(asset('Settings'));
    expect(submit()).toBeEnabled();
    await act(async () => { fireEvent.click(submit()); });
    expect(onSubmit.mock.calls[0]![0].map((a) => a.id)).toEqual(['code']);
  });

  it('goes on saying a submission was sent under a host that makes its workspace anew each time it draws', async () => {
    function Host({ tick }: { tick: number }) {
      const [roots, setRoots] = useState(WORKSPACE.assets.map((a) => a.root));
      const workspace: Workspace = { assets: WORKSPACE.assets.map((a, i) => ({ ...a, root: roots[i]! })) };
      return <AssetEditor key="editor" list className={`t${tick}`} workspace={workspace} original={WORKSPACE} codec={workspaceCodec([])} onChange={(next) => setRoots(next.assets.map((a) => a.root))} onSubmit={() => {}} />;
    }
    const view = render(<Host tick={0} />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    await act(async () => { fireEvent.click(submit()); });
    expect(submit()).toHaveTextContent('Sent');
    view.rerender(<Host tick={1} />);
    expect(submit()).toHaveTextContent('Sent');
  });
});
