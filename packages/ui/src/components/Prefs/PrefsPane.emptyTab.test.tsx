import { cleanup, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { PrefsPane } from './PrefsPane';
import type { WalkCtx } from './PrefsRow';

afterEach(cleanup);

const flag = (name: string, more: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...more }) as PrefLeaf;

const PAGE: PrefGroup = {
  name: 'Page',
  children: {
    one: { name: 'One', as: 'tab', children: { a: flag('Alpha') } },
    empty: { name: 'Empty', as: 'tab', children: {} },
    veiled: { name: 'Veiled', as: 'tab', children: { v: flag('Vee', { hidden: true }) } },
    two: { name: 'Two', as: 'tab', children: { b: flag('Beta') } },
  },
};

const tabs = (): Array<string | null> => within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent);

function pane(more: Partial<WalkCtx> = {}) {
  const ctx: WalkCtx = { values: {}, onChange: () => {}, ...more };
  render(<PrefsPane ctx={ctx} group={PAGE} path="" scrollRef={createRef()} />);
}

describe('a tab with no row to draw, in PrefsPane', () => {
  it('is left out of the strip, and the tabs around it share one', () => {
    pane();
    expect(tabs()).toEqual(['One', 'Two']);
  });

  it('counts a hidden leaf as a row where the form draws hidden leaves', () => {
    pane({ showHidden: true });
    expect(tabs()).toEqual(['One', 'Veiled', 'Two']);
  });

  it('stays in a form that keeps empty groups to drop into', () => {
    render(<PrefsForm schema={{ name: 'Root', children: { page: PAGE } }} values={{}} onChange={() => {}} layout="list" showEmpty />);
    expect(tabs()).toEqual(['One', 'Empty', 'Veiled', 'Two']);
  });
});
