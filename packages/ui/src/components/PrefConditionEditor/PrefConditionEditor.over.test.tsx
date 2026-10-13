import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { conditionLeaves } from './conditionLeaves';
import { PrefConditionEditor } from './PrefConditionEditor';

afterEach(cleanup);

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });

// The schema the settings live in, and a layout drawn over it.
const SETTINGS: PrefGroup = { name: 'Settings', children: { view: { name: 'View', children: { grid: flag('Show grid'), both: flag('Theirs') } } } };
const LAYOUT: PrefGroup = { name: 'Layout', children: { view: { name: 'View', children: { both: flag('Ours'), tight: flag('Tight') } } } };

const open = (value?: PrefCondition, over?: PrefGroup) => {
  const onChange = vi.fn();
  render(<PrefConditionEditor aria-label="Shown if" schema={LAYOUT} over={over} value={value} onChange={onChange} />);
  return onChange;
};
const offered = (): string[] => {
  fireEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
  return screen.getAllByRole('option').map((o) => o.textContent ?? '');
};

describe('the prefs a condition may read, with a schema the condition\'s is drawn over', () => {
  it('are that schema\'s after the condition\'s own, less each at a path its own holds', () => {
    expect(conditionLeaves(LAYOUT, undefined, SETTINGS).map((l) => [l.path, l.leaf.name, l.over ?? false])).toEqual([
      ['view.both', 'Ours', false],
      ['view.tight', 'Tight', false],
      ['view.grid', 'Show grid', true],
    ]);
  });
});

describe('PrefConditionEditor over another schema', () => {
  it('offers that schema\'s prefs, each named for the schema it is in', () => {
    open(undefined, SETTINGS);
    expect(offered()).toEqual(['Ours view.both', 'Tight view.tight', 'Show grid Settings: view.grid']);
  });

  it('writes a test on one as a test on any other pref', () => {
    const onChange = open(undefined, SETTINGS);
    fireEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    fireEvent.click(screen.getByRole('option', { name: /Show grid/ }));
    expect(onChange).toHaveBeenCalledWith({ path: 'view.grid', is: true });
  });

  it('draws a row that reads one as its controls, with nothing said against it', () => {
    open({ path: 'view.grid', is: true }, SETTINGS);
    const row = screen.getByRole('group', { name: 'Condition 1' });
    expect(row).not.toHaveAttribute('data-invalid');
    expect(within(row).getByRole('button', { name: /Condition 1 comparison/ })).toBeInTheDocument();
    expect(row).not.toHaveTextContent('no leaf holds');
  });

  it('says a row reads no leaf where neither schema holds its path, and with no second schema', () => {
    open({ path: 'view.gone', is: true }, SETTINGS);
    expect(screen.getByRole('group', { name: 'Condition 1' })).toHaveTextContent('no leaf holds a value at "view.gone"');
    cleanup();
    open({ path: 'view.grid', is: true });
    expect(screen.getByRole('group', { name: 'Condition 1' })).toHaveTextContent('no leaf holds a value at "view.grid"');
  });
});
