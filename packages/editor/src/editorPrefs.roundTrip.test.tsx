import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { openPrefsSync, pref, type PrefKind, type PrefLeaf, type PrefsStore } from '@weasel-js/prefs';
import { createMemoryAdapter } from '@weasel-js/storage';
import { renderWithIcons as render } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorPrefsDialog } from './editorPrefs';

afterEach(cleanup);

type ValueKind = Exclude<PrefKind, 'action' | 'actions' | 'alias' | 'label' | 'separator'>;

const num = pref.number('Width', 1, { min: 0, max: 10 });
const variant = { kind: 'object', name: 'Linear', description: '', default: { angle: 0 }, children: { angle: pref.number('Angle', 0, { min: 0, max: 360 }) } } as const;

/** One leaf of every kind that holds a value, each with a value to set that is not its default. A kind added to
 *  `PrefKind` does not compile here until it has one. */
const KINDS = {
  number: [pref.number('A number', 5, { min: 0, max: 100 }), 9],
  boolean: [pref.boolean('A boolean', false), true],
  string: [pref.string('A string', 'a'), 'b'],
  enum: [pref.enum('An enum', 'one', ['one', 'two']), 'two'],
  color: [pref.color('A color', '#000000'), '#ff0000'],
  paint: [{ kind: 'paint', name: 'A paint', description: '', default: { kind: 'solid', color: '#000000ff' } }, { kind: 'solid', color: '#ff0000ff' }],
  object: [{ kind: 'object', name: 'An object', description: '', default: { width: 1 }, children: { width: num } }, { width: 2 }],
  list: [{ kind: 'list', name: 'A list', description: '', default: [1], item: num }, [1, 2]],
  map: [{ kind: 'map', name: 'A map', description: '', default: { a: 1 }, item: num }, { a: 1, b: 2 }],
  union: [{ kind: 'union', name: 'A union', description: '', default: { type: 'linear', angle: 0 }, tag: 'type', variants: { linear: variant } }, { type: 'linear', angle: 45 }],
  field: [{ kind: 'field', name: 'A field', description: '', default: 'all.number' }, 'all.boolean'],
} satisfies Record<ValueKind, [PrefLeaf, unknown]>;

const LEAVES = Object.fromEntries(Object.entries(KINDS).map(([kind, [leaf]]) => [kind, leaf])) as {
  [K in ValueKind]: (typeof KINDS)[K][0];
};

const SCHEMA = pref.group('Preferences', {
  all: pref.group('Every kind', {
    ...LEAVES,
    heading: pref.label('A heading'),
    rule: pref.separator(),
    alsoNumber: { kind: 'alias', name: 'Same number', description: '', of: 'all.number' },
    split: pref.number('A split number', 4, { min: 0, max: 10, scopes: [{ selector: 'all.enum' }] }),
  }),
});

const PREFIX = 'test.prefs/';

function opened(backing: Map<string, unknown>): PrefsStore<typeof SCHEMA> {
  return openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: PREFIX });
}

const dialog = (store: PrefsStore<typeof SCHEMA>) =>
  render(<EditorPrefsDialog store={store} isOpen onOpenChange={() => {}} dialog={{ layout: 'list' }} />);

describe('EditorPrefsDialog over a stored schema', () => {
  it('draws a row for every kind of leaf', () => {
    dialog(opened(new Map()));
    for (const leaf of Object.values(LEAVES)) expect(screen.getAllByText(leaf.name).length).toBeGreaterThan(0);
    expect(screen.getByText('A heading')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Same number' })).toHaveValue('5');
    expect(screen.queryByText(/no renderer\)$/)).toBeNull();
  });

  it('keeps a value of every kind through storage and a reopen', async () => {
    const backing = new Map<string, unknown>();
    const store = opened(backing);
    for (const [kind, [, next]] of Object.entries(KINDS)) store.set(`all.${kind}` as never, next as never);
    expect(await store.flush()).toBe(true);
    const again = opened(backing);
    for (const [kind, [, next]] of Object.entries(KINDS)) expect([kind, again.get(`all.${kind}` as never)]).toEqual([kind, next]);
  });

  it('writes an edit made in the dialog, which a reopened store and its dialog read', async () => {
    const backing = new Map<string, unknown>();
    const store = opened(backing);
    dialog(store);
    const field = screen.getByRole('spinbutton', { name: 'A number' });
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.blur(field);
    fireEvent.click(screen.getByRole('checkbox', { name: 'A boolean' }));
    expect(await store.flush()).toBe(true);
    cleanup();
    dialog(opened(backing));
    expect(screen.getByRole('spinbutton', { name: 'A number' })).toHaveValue('12');
    expect(screen.getByRole('checkbox', { name: 'A boolean' })).toBeChecked();
  });

  it('writes through an alias row at its target', () => {
    const store = opened(new Map());
    dialog(store);
    const alias = screen.getByRole('spinbutton', { name: 'Same number' });
    fireEvent.change(alias, { target: { value: '30' } });
    fireEvent.blur(alias);
    expect(store.get('all.number')).toBe(30);
  });

  it("unsets a leaf from its label's Auto toggle, and a reopen reads its default as unset", async () => {
    const backing = new Map<string, unknown>();
    const store = opened(backing);
    store.set('all.number', 9);
    dialog(store);
    const pin = screen.getAllByRole('button', { name: 'Pin A number' })[0]!;
    act(() => { fireEvent.click(pin); });
    expect(store.isSet('all.number')).toBe(false);
    expect(await store.flush()).toBe(true);
    const again = opened(backing);
    expect(again.isSet('all.number')).toBe(false);
    expect(again.get('all.number')).toBe(5);
  });

  it('pins a leaf from its Auto toggle at the value it shows', async () => {
    const backing = new Map<string, unknown>();
    const store = opened(backing);
    dialog(store);
    act(() => { fireEvent.click(screen.getAllByRole('button', { name: 'Pin A string' })[0]!); });
    expect(store.isSet('all.string')).toBe(true);
    expect(await store.flush()).toBe(true);
    expect(opened(backing).isSet('all.string')).toBe(true);
  });

  it('splits a scoped leaf into its members and writes one at its selection', async () => {
    const backing = new Map<string, unknown>();
    const store = opened(backing);
    dialog(store);
    fireEvent.click(screen.getByRole('button', { name: 'A split number by An enum' }));
    const members = screen.getByRole('group', { name: 'A split number by An enum' });
    const two = within(members).getByRole('spinbutton', { name: 'A split number, Two' });
    fireEvent.change(two, { target: { value: '8' } });
    fireEvent.blur(two);
    expect(await store.flush()).toBe(true);
    const again = opened(backing);
    expect(again.get('all.split')).toBe(4);
    again.set('all.enum', 'two');
    expect(again.get('all.split')).toBe(8);
  });
});
