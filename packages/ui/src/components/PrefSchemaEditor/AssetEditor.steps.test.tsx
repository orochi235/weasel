import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { asset, Live, pickRow, rekey, structure, tool } from './AssetEditor.fixture';
import type { Workspace } from './workspace';
import { CODE, WORKSPACE } from './workspace.fixtures';

afterEach(cleanup);

// The panel's pointers under a heading, which can be re-keyed as a pointer cannot.
const START: Workspace = { assets: [WORKSPACE.assets[0]!, { ...WORKSPACE.assets[1]!, root: { name: 'Code', children: { rows: { name: 'Rows', as: 'section', children: CODE.children } } } }] };

/** The asset shown, and the keys of the rows selected in it. */
const shown = () => ({
  asset: ['Settings', 'Code'].find((label) => asset(label).getAttribute('aria-selected') === 'true'),
  selected: [...structure().querySelectorAll('[role="treeitem"][aria-selected="true"]')].map((el) => /\((\w+)\)/.exec(el.firstElementChild!.textContent)![1]),
});

describe('AssetEditor steps across assets', () => {
  it('selects in the asset a step lands on what was selected there, however many times the step is taken', () => {
    render(<Live start={START} />);
    pickRow('grid');
    rekey('lines');
    fireEvent.click(asset('Code'));
    pickRow('rows');
    rekey('main');
    expect(shown()).toEqual({ asset: 'Code', selected: ['main'] });

    fireEvent.click(tool('Undo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['rows'] });
    fireEvent.click(tool('Undo'));
    expect(shown()).toEqual({ asset: 'Settings', selected: ['grid'] });
    fireEvent.click(tool('Redo'));
    expect(shown()).toEqual({ asset: 'Settings', selected: ['lines'] });
    fireEvent.click(tool('Redo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['main'] });
    fireEvent.click(tool('Undo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['rows'] });
  });

  it('selects it when the step is taken from the other asset', () => {
    render(<Live start={START} />);
    fireEvent.click(asset('Code'));
    pickRow('rows');
    rekey('main');
    fireEvent.click(asset('Settings'));
    pickRow('snap');
    fireEvent.click(tool('Undo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['rows'] });
    fireEvent.click(asset('Settings'));
    pickRow('grid');
    fireEvent.click(tool('Redo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['main'] });
    fireEvent.click(asset('Settings'));
    fireEvent.click(tool('Undo'));
    expect(shown()).toEqual({ asset: 'Code', selected: ['rows'] });
  });
});
