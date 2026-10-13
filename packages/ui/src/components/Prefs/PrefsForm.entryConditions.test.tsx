import { cleanup, render, screen, within } from '@testing-library/react';
import { applyPrefEntryConditions, prefJudge, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefControl } from './PrefControl';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

type Extra = Record<string, unknown>;
const num = (name: string, extra: Extra = {}): PrefLeaf => ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string, extra: Extra = {}): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const object = (name: string, children: Record<string, PrefLeaf>, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'object', name, description: '', default: {}, children, ...extra }) as PrefLeaf;
const list = (name: string, item: PrefLeaf): PrefLeaf => ({ kind: 'list', name, description: '', default: [], item }) as PrefLeaf;
const map = (name: string, item: PrefLeaf): PrefLeaf => ({ kind: 'map', name, description: '', default: {}, item }) as PrefLeaf;

const held = { from: 'item', path: 'held' } as const;
const step = object('Step', { on: flag('Step on'), size: num('Step size', { showIf: { from: 'item', path: 'on' } }) });
const phase = object('Phase', {
  held: flag('Held'),
  hold: num('Hold', { showIf: held }),
  gain: num('Gain', { enableIf: held }),
  steps: list('Steps', step),
});
const schema: PrefGroup = {
  name: '',
  children: {
    // A root pref of the same name as the entry's field, which an entry's test does not read.
    held: flag('Held at the root'),
    phases: list('Phases', phase),
    byName: map('By name', phase),
    locks: list('Locks', object('Lock', { locked: flag('Locked'), depth: num('Depth') }, { enableIf: { from: 'item', path: 'locked', isNot: true } })),
  },
};
const values = {
  held: false,
  phases: [{ held: true, steps: [{ on: false }, { on: true }] }, { held: false }],
  byName: { a: { held: false }, b: { held: true } },
  locks: [{ locked: true }, { locked: false }],
};

describe('PrefsForm conditions that read the entry', () => {
  it('hides and disables a field in each entry of a list by that entry\'s own value', () => {
    render(<PrefsForm schema={{ name: '', children: { held: schema.children.held!, phases: schema.children.phases! } }} values={values} onChange={() => {}} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Hold' })).toHaveLength(1);
    const [first, second] = screen.getAllByRole('spinbutton', { name: 'Gain' });
    expect(first).toBeEnabled();
    expect(second).toBeDisabled();
    expect(second!.closest('[data-property-row][data-disabled]')).not.toBeNull();
  });

  it('does the same in each entry of a map', () => {
    render(<PrefsForm schema={{ name: '', children: { byName: schema.children.byName! } }} values={values} onChange={() => {}} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Hold' })).toHaveLength(1);
    const [a, b] = screen.getAllByRole('spinbutton', { name: 'Gain' });
    expect(a).toBeDisabled();
    expect(b).toBeEnabled();
  });

  it('reads the nearest entry inside a list within a list', () => {
    render(<PrefsForm schema={{ name: '', children: { phases: schema.children.phases! } }} values={values} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox', { name: 'Step on' })).toHaveLength(2);
    expect(screen.getAllByRole('spinbutton', { name: 'Step size' })).toHaveLength(1);
  });

  it("disables one entry by the item's own enableIf, and leaves the next", () => {
    render(<PrefsForm schema={{ name: '', children: { locks: schema.children.locks! } }} values={values} onChange={() => {}} />);
    const [first, second] = screen.getAllByRole('spinbutton', { name: 'Depth' });
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();
  });

  it("disables one text entry by the item's own enableIf, leaves the next, and still lets it be removed", () => {
    const tags = list('Tags', { kind: 'string', name: 'Tag', description: '', default: '', enableIf: { from: 'item', path: '', isNot: 'fixed' } } as PrefLeaf);
    render(<PrefsForm schema={{ name: '', children: { tags } }} values={{ tags: ['fixed', 'free'] }} onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Tag 1' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Tag 2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Tag 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('keeps and marks a field an entry hides where hidden prefs are marked', () => {
    render(<PrefsForm markHidden schema={{ name: '', children: { phases: schema.children.phases! } }} values={values} onChange={() => {}} />);
    const holds = screen.getAllByRole('spinbutton', { name: 'Hold' });
    expect(holds).toHaveLength(2);
    expect(holds[0]!.closest('[data-pref-hidden]')).toBeNull();
    expect(holds[1]!.closest('[data-pref-hidden]')).not.toBeNull();
  });
});

describe('PrefControl', () => {
  it('draws each entry as its owner says the conditions that read it leave it', () => {
    const phases = schema.children.phases as PrefLeaf;
    render(
      <PrefControl pref={phases} path="phases" value={values.phases} onChange={() => {}}
        entryAt={(item, path, value) => applyPrefEntryConditions(item, path, prefJudge(schema, () => undefined, { item, value }))} />,
    );
    expect(screen.getAllByRole('spinbutton', { name: 'Hold' })).toHaveLength(1);
    expect(within(document.body).getAllByRole('spinbutton', { name: 'Gain' })[1]).toBeDisabled();
  });
});
