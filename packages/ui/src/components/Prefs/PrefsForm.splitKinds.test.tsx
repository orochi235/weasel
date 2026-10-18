import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf, PrefLocus } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { PrefsForm, type PrefsFormProps } from './index';

afterEach(cleanup);

const MODE = 'look.mode';
const LOOK: PrefGroup = {
  name: 'Look',
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
    },
  },
};
const byMode = (dark: unknown, light: unknown): PrefLocus => ({ $by: MODE, $of: { dark, light } });
const flag = { kind: 'boolean', name: 'Flag', description: '', default: false } as const;

/** A form of `look` and one leaf at `key`, held split by mode as `locus`, with that row open. */
function openSplit(key: string, leaf: PrefLeaf, locus: PrefLocus, props: Partial<PrefsFormProps> = {}) {
  const schema: PrefGroup = { name: 'Prefs', children: { look: LOOK, [key]: { ...leaf, splitBy: [MODE] } as PrefLeaf } };
  const onChangeAt = vi.fn();
  renderWithIcons(
    <PrefsForm schema={schema} layout="list" values={{}} onChange={vi.fn()} loci={new Map([[key, locus]])}
      onChangeAt={onChangeAt} onJoin={vi.fn()} defaultSplitOpen={[key]} {...props} />,
  );
  const members = screen.getByRole('group', { name: `${leaf.name} by Mode` });
  return { onChangeAt, members, light: () => within(members).getAllByRole('group').at(-1)! };
}

describe('a split row of a compound kind opens to one editor per option', () => {
  it('a list, each member its own list, an edit writing that member whole', () => {
    const list = { kind: 'list', name: 'Flags', description: '', default: [], item: flag } as PrefLeaf;
    const { members, onChangeAt } = openSplit('flags', list, byMode([false], [true, false]));
    expect(within(members).getAllByRole('checkbox')).toHaveLength(3);
    const lights = within(members).getAllByRole('checkbox', { name: /^Flag / }).slice(1);
    fireEvent.click(lights[1]!);
    expect(onChangeAt).toHaveBeenCalledWith('flags', [true, true], { [MODE]: 'light' });
  });

  it('a map, each member its own record', () => {
    const map = { kind: 'map', name: 'Sides', description: '', default: {}, item: flag } as PrefLeaf;
    const { members, onChangeAt } = openSplit('sides', map, byMode({ left: false }, { top: true, right: false }));
    expect(within(members).getAllByRole('textbox').map((el) => (el as HTMLInputElement).value)).toEqual(['left', 'top', 'right']);
    fireEvent.click(within(members).getByRole('checkbox', { name: 'Flag right' }));
    expect(onChangeAt).toHaveBeenCalledWith('sides', { top: true, right: true }, { [MODE]: 'light' });
  });

  it('a union, each member drawing the fields of its own variant', () => {
    const union = {
      kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'circle', filled: false },
      variants: {
        circle: { kind: 'object', name: 'Circle', description: '', default: { filled: false }, children: { filled: { ...flag, name: 'Filled' } } },
        box: { kind: 'object', name: 'Box', description: '', default: { square: false }, children: { square: { ...flag, name: 'Square' } } },
      },
    } as PrefLeaf;
    const { members, onChangeAt } = openSplit('shape', union, byMode({ type: 'circle', filled: true }, { type: 'box', square: false }));
    expect(within(members).getByRole('checkbox', { name: 'Filled' })).toBeChecked();
    fireEvent.click(within(members).getByRole('checkbox', { name: 'Square' }));
    expect(onChangeAt).toHaveBeenCalledWith('shape', { type: 'box', square: true }, { [MODE]: 'light' });
  });
});

describe('a split row the form draws for another reason', () => {
  it('opens a hidden row, marked, to its members', () => {
    const gap = { kind: 'number', name: 'Gap', description: '', default: 4, showIf: { path: 'look.mode', is: 'light' } } as unknown as PrefLeaf;
    const { members, onChangeAt } = openSplit('gap', gap, byMode(4, 8), { markHidden: true });
    expect(within(members).getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('8');
    const field = within(members).getByRole('spinbutton', { name: 'Gap, Dark' });
    fireEvent.change(field, { target: { value: '6' } });
    fireEvent.blur(field);
    expect(onChangeAt).toHaveBeenCalledWith('gap', 6, { [MODE]: 'dark' });
    expect(screen.getAllByText(/hidden/i).length).toBeGreaterThan(0);
  });

  it('opens an alias row to the members of the leaf it shows, read and written at that leaf’s path', () => {
    const over: PrefGroup = {
      name: 'App',
      children: { look: LOOK, panel: { name: 'Panel', children: { gap: { kind: 'number', name: 'Gap', description: '', default: 4, splitBy: [MODE] } } } },
    };
    const schema: PrefGroup = {
      name: 'Tool', children: { gap: { kind: 'alias', name: 'Spacing', description: '', default: undefined, of: 'panel.gap' } as PrefLeaf },
    };
    const onChangeAt = vi.fn();
    renderWithIcons(
      <PrefsForm schema={schema} over={over} layout="list" values={{}} onChange={vi.fn()}
        loci={new Map([['panel.gap', byMode(4, 8)]])} onChangeAt={onChangeAt} defaultSplitOpen={['gap']} />,
    );
    const members = screen.getByRole('group', { name: 'Spacing by Mode' });
    expect(within(members).getByRole('spinbutton', { name: 'Spacing, Light' })).toHaveValue('8');
    const field = within(members).getByRole('spinbutton', { name: 'Spacing, Dark' });
    fireEvent.change(field, { target: { value: '2' } });
    fireEvent.blur(field);
    expect(onChangeAt).toHaveBeenCalledWith('panel.gap', 2, { [MODE]: 'dark' });
  });
});
