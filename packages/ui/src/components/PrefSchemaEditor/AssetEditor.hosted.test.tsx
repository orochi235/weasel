import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { asset, assets, hasRow, Live, WORKSPACE } from './AssetEditor.fixture';
import type { Workspace } from './workspace';
import { pointer } from './workspace.fixtures';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const WITH_BAR: Workspace = {
  assets: [...WORKSPACE.assets, { id: 'tools', label: 'Tools', kind: 'layout', over: 'settings', root: { name: 'Tools', as: 'bar', children: { snap: pointer('view.snap') } } }],
};

describe('AssetEditor asset list headings', () => {
  it('lists a layout whose root is drawn as a bar under Toolbars, and any other under Panels', () => {
    renderWithIcons(<Live start={WITH_BAR} />);
    expect(within(within(assets()).getByRole('group', { name: 'Toolbars' })).getByRole('option', { name: 'Tools' })).toBeInTheDocument();
    expect(within(within(assets()).getByRole('group', { name: 'Panels' })).queryByRole('option', { name: 'Tools' })).toBeNull();
  });

  it('lists what another editor holds among its own by name, and hands a pick of one to the host', () => {
    const onElsewhere = vi.fn();
    renderWithIcons(<Live elsewhere={[{ id: 'reader', label: 'Reader prefs', under: 'Dialogs' }]} onElsewhere={onElsewhere} />);
    const dialogs = within(within(assets()).getByRole('group', { name: 'Dialogs' })).getAllByRole('option').map((o) => o.textContent);
    expect(dialogs).toEqual(['Reader prefs', 'Settings']);
    fireEvent.click(asset('Reader prefs'));
    expect(onElsewhere).toHaveBeenCalledWith('reader');
    expect(asset('Settings')).toHaveAttribute('aria-selected', 'true');
    expect(asset('Reader prefs')).toHaveAttribute('aria-selected', 'false');
  });

  it('lists its own and another editor\'s in the order the host gives', () => {
    renderWithIcons(<Live elsewhere={[{ id: 'reader', label: 'Reader prefs', under: 'Dialogs' }]} order={['reader', 'settings']} />);
    const dialogs = within(within(assets()).getByRole('group', { name: 'Dialogs' })).getAllByRole('option').map((o) => o.textContent);
    expect(dialogs).toEqual(['Reader prefs', 'Settings']);
  });

  it('starts on the asset it is told to, and on the first for one it does not hold', () => {
    const { unmount } = renderWithIcons(<Live startOn="code" />);
    expect(asset('Code')).toHaveAttribute('aria-selected', 'true');
    expect(hasRow('view')).toBe(false);
    unmount();
    renderWithIcons(<Live startOn="nowhere" />);
    expect(asset('Settings')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('AssetEditor host preview', () => {
  it('draws what the host makes of an asset, handed the dialog a layout is over, and its own where the host makes nothing', () => {
    const seen: Array<[string, string | undefined]> = [];
    renderWithIcons(<Live preview={(shown, over) => { seen.push([shown.id, over?.name]); return shown.kind === 'layout' ? <p>drawn by the host: {shown.label}</p> : undefined; }} />);
    expect(within(preview()).getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    fireEvent.click(asset('Code'));
    expect(within(preview()).getByText('drawn by the host: Code')).toBeInTheDocument();
    expect(within(preview()).queryByRole('checkbox')).toBeNull();
    expect(seen).toContainEqual(['settings', undefined]);
    expect(seen).toContainEqual(['code', 'Settings']);
  });
});
