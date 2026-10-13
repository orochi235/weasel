import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { asset, attributes, Live, pickRow, row, SETTINGS } from './AssetEditor.fixture';
import { conditionProblems } from './conditionMarks';
import type { Workspace } from './workspace';
import { pointer } from './workspace.fixtures';

afterEach(cleanup);

// A layout whose groups are shown by settings of the dialog it is drawn over, one of which the dialog does not hold.
const LAYOUT: PrefGroup = {
  name: 'Panel',
  children: {
    rows: { name: 'Rows', as: 'section', showIf: { path: 'view.grid' }, children: { snap: pointer('view.snap') } },
    lost: { name: 'Lost', as: 'section', showIf: { path: 'view.gone' }, children: { grid: pointer('view.grid') } },
  },
};
const WORKSPACE: Workspace = {
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: SETTINGS },
    { id: 'panel', label: 'Panel', kind: 'layout', root: LAYOUT, over: 'settings' },
  ],
};

describe('what is wrong with a layout\'s conditions, held to the dialog it is drawn over', () => {
  it('is a path neither holds, and not one the dialog does', () => {
    expect([...conditionProblems(LAYOUT).keys()]).toEqual(['rows', 'lost']);
    expect([...conditionProblems(LAYOUT, SETTINGS).keys()]).toEqual(['lost']);
  });
});

describe('AssetEditor on a layout whose conditions read its dialog\'s settings', () => {
  it('marks a condition bad only where it reads a setting the dialog does not hold', () => {
    render(<Live start={WORKSPACE} />);
    fireEvent.click(asset('Panel'));
    expect(within(row('rows')).queryByText('bad condition')).toBeNull();
    expect(within(row('lost')).getByText('bad condition')).toBeInTheDocument();
  });

  it('offers the dialog\'s settings to a condition, named for the dialog, and says nothing against a row that reads one', () => {
    render(<Live start={WORKSPACE} />);
    fireEvent.click(asset('Panel'));
    pickRow('rows');
    const shownIf = within(attributes()).getByRole('group', { name: 'Shown if' });
    expect(shownIf).not.toHaveTextContent('no leaf holds');
    fireEvent.click(within(shownIf).getByRole('button', { name: /Add a condition/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Show grid Settings: view.grid', 'Snap Settings: view.snap']);
  });
});
