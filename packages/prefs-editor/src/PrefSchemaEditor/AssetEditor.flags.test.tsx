import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { AssetEditor } from './AssetEditor';
import { asset, hasRow, pickRow, structure, tool } from './AssetEditor.fixture';
import { type AssetSet, assetSetCodec } from '@weasel-js/prefs/edit';
import { ASSET_SET } from '@weasel-js/prefs/testing/editAssetSet';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

const codec = assetSetCodec([]);

/** A host that keeps the asset set, and can lock and relabel its panel as a host's own state would. */
function Host({ seen }: { seen(assetSet: AssetSet): void }) {
  const [assetSet, setAssetSet] = useState(ASSET_SET);
  seen(assetSet);
  return (
    <>
      <button type="button" onClick={() => setAssetSet((w) => ({ assets: w.assets.map((a) => (a.id === 'code' ? { ...a, readOnly: true, label: 'Code panel' } : a)) }))}>Lock the panel</button>
      <AssetEditor list assetSet={assetSet} codec={codec} onChange={setAssetSet} />
    </>
  );
}

describe('AssetEditor under a host that changes an asset between steps', () => {
  it('steps the roots back and forward, and leaves a lock and a label as the host has them now', () => {
    let latest: AssetSet = ASSET_SET;
    renderWithIcons(<Host seen={(w) => { latest = w; }} />);
    pickRow('snap');
    fireEvent.keyDown(structure(), { key: 'Delete' });
    fireEvent.click(screen.getByRole('button', { name: 'Lock the panel' }));
    const locked = () => {
      expect(within(asset('Code panel')).getByRole('img', { name: 'Dynamic' })).toBeInTheDocument();
      expect(latest.assets[1]).toMatchObject({ id: 'code', readOnly: true, label: 'Code panel' });
    };
    locked();
    fireEvent.click(tool('Undo'));
    expect(hasRow('snap')).toBe(true);
    expect(latest.assets.map((a) => a.root)).toEqual(ASSET_SET.assets.map((a) => a.root));
    locked();
    fireEvent.click(tool('Redo'));
    expect(hasRow('snap')).toBe(false);
    locked();
  });
});
