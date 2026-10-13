import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefCondition, PrefGroup, PrefLeaf, PrefList } from '@weasel-js/prefs';
import { PrefConditionEditor } from './PrefConditionEditor';

afterEach(cleanup);

const SCHEMA: PrefGroup = { name: 'Root', children: {
  view: { name: 'View', children: {
    grid: { kind: 'boolean', name: 'Show grid', description: '', default: false },
    units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }, { value: 'in', label: 'Inches' }] } as PrefLeaf,
    step: { kind: 'number', name: 'Zoom step', description: '', default: 10 },
    author: { kind: 'string', name: 'Author', description: '', default: '' } as PrefLeaf,
  } },
} };

/** The editor over a condition it holds, with what it last wrote in `seen.value` and how often in `seen.writes`. */
function Live({ start, seen, schema = SCHEMA }: { start?: PrefCondition; seen: { value?: PrefCondition; writes: number }; schema?: PrefGroup }) {
  const [value, setValue] = useState<PrefCondition | undefined>(start);
  seen.value = value;
  return <PrefConditionEditor aria-label="Shown if" schema={schema} value={value} onChange={(next) => { seen.writes++; setValue(next); }} />;
}
const open = (start?: PrefCondition, schema?: PrefGroup) => {
  const seen: { value?: PrefCondition; writes: number } = { writes: 0 };
  render(<Live start={start} seen={seen} schema={schema} />);
  return seen;
};

const row = (n: number) => screen.getByRole('group', { name: `Condition ${n}` });
const pick = (within_: HTMLElement, button: RegExp, option: string | RegExp) => {
  fireEvent.click(within(within_).getByRole('button', { name: button }));
  fireEvent.click(screen.getByRole('option', { name: option }));
};
const offered = (within_: HTMLElement, button: RegExp): string[] => {
  fireEvent.click(within(within_).getByRole('button', { name: button }));
  const names = screen.getAllByRole('option').map((o) => o.textContent ?? '');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  return names;
};
/** The control that says which rows of a group must hold: the editor's own, or with `of`, that of the group at a row. */
const quantifier = (of?: HTMLElement) => (of ? within(of).getAllByRole('button', { name: /Which rows of/ })[0]! : screen.getAllByRole('button', { name: /Which rows must hold/ })[0]!);
const quantify = (label: string, of?: HTMLElement) => {
  fireEvent.click(quantifier(of));
  fireEvent.click(screen.getByRole('option', { name: label }));
};
const add = (option: RegExp) => pick(screen.getByRole('group', { name: 'Shown if' }), /Add a condition/, option);

describe('PrefConditionEditor', () => {
  it('draws no row for no condition, and writes a first row as the test alone', () => {
    const seen = open();
    expect(screen.queryByRole('group', { name: 'Condition 1' })).toBeNull();
    add(/Show grid/);
    expect(seen.value).toEqual({ path: 'view.grid', is: true });
    expect(within(row(1)).getByRole('button', { name: /pref/ })).toHaveTextContent('Show grid');
    expect(within(row(1)).getByRole('button', { name: /pref/ })).toHaveTextContent('view.grid');
  });

  it('writes no condition, and not an empty all, once its last row is removed', () => {
    const seen = open({ any: [{ path: 'view.grid' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove condition 1' }));
    expect(seen.writes).toBe(1);
    expect(seen.value).toBeUndefined();
  });

  it('combines a second row under all of, and under any of once that is picked', () => {
    const seen = open({ path: 'view.grid', is: true });
    expect(screen.queryByRole('button', { name: /Which rows must hold/ })).toBeNull();
    add(/Author/);
    expect(seen.value).toEqual({ all: [{ path: 'view.grid', is: true }, { path: 'view.author' }] });
    quantify('Any of');
    expect(seen.value).toEqual({ any: [{ path: 'view.grid', is: true }, { path: 'view.author' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove condition 1' }));
    expect(seen.value).toEqual({ any: [{ path: 'view.author' }] });
  });

  it('offers a boolean on and off, and anything else whether it is set or not', () => {
    const seen = open({ all: [{ path: 'view.grid' }, { path: 'view.author' }] });
    expect(offered(row(1), /comparison/)).toEqual(['is on', 'is off']);
    expect(offered(row(2), /comparison/)).toEqual(['is set', 'is not set']);
    pick(row(1), /comparison/, 'is off');
    expect(seen.value).toEqual({ all: [{ path: 'view.grid', is: false }, { path: 'view.author' }] });
  });

  it('offers an enum is, is not, is one of, and is none of, over that leaf\'s own options', () => {
    const seen = open({ path: 'view.units', is: 'px' });
    expect(offered(row(1), /comparison/)).toEqual(['is', 'is not', 'is one of', 'is none of']);
    expect(offered(row(1), /value/)).toEqual(['Pixels', 'Millimeters', 'Inches']);
    pick(row(1), /value/, 'Millimeters');
    expect(seen.value).toEqual({ path: 'view.units', is: 'mm' });
    pick(row(1), /comparison/, 'is one of');
    expect(seen.value).toEqual({ path: 'view.units', in: ['mm'] });
    fireEvent.click(within(row(1)).getByRole('checkbox', { name: 'Inches' }));
    expect(seen.value).toEqual({ path: 'view.units', in: ['mm', 'in'] });
    fireEvent.click(within(row(1)).getByRole('checkbox', { name: 'Millimeters' }));
    expect(seen.value).toEqual({ path: 'view.units', in: ['in'] });
  });

  it('offers a number the ordering comparisons, with a number to compare against', () => {
    const seen = open({ path: 'view.step', above: 4 });
    expect(offered(row(1), /comparison/)).toEqual(['is above', 'is at least', 'is below', 'is at most', 'is', 'is not']);
    pick(row(1), /comparison/, 'is at most');
    expect(seen.value).toEqual({ path: 'view.step', atMost: 4 });
    const box = within(row(1)).getByRole('spinbutton', { name: 'Condition 1 value' });
    fireEvent.change(box, { target: { value: '12' } });
    fireEvent.blur(box);
    expect(seen.value).toEqual({ path: 'view.step', atMost: 12 });
  });

  it('shows a number with a display unit in that unit, reads one typed in it, and writes the stored number', () => {
    const turn = {
      kind: 'number', name: 'Turn', description: '', default: 0,
      unit: { toDisplay: (r: number) => (r * 180) / Math.PI, fromDisplay: (d: number) => (d * Math.PI) / 180, suffix: '°', accepts: { turn: 360 } },
    } as PrefLeaf;
    const seen = open({ path: 'turn', above: Math.PI }, { name: 'Root', children: { turn } });
    const box = within(row(1)).getByRole('spinbutton', { name: 'Condition 1 value' });
    expect(box).toHaveValue('180');
    expect(row(1)).toHaveTextContent('°');
    fireEvent.change(box, { target: { value: '90°' } });
    fireEvent.blur(box);
    expect((seen.value as { above: number }).above).toBeCloseTo(Math.PI / 2, 10);
    fireEvent.change(box, { target: { value: '0.5turn' } });
    fireEvent.blur(box);
    expect((seen.value as { above: number }).above).toBeCloseTo(Math.PI, 10);
  });

  it('starts a row pointed at another pref over at that pref\'s kind', () => {
    const seen = open({ path: 'view.units', is: 'mm' });
    pick(row(1), /pref/, /Zoom step/);
    expect(seen.value).toEqual({ path: 'view.step', above: 0 });
  });

  it('writes what is not set, and what is none of some options, as the not of a test', () => {
    const seen = open({ all: [{ path: 'view.author' }, { path: 'view.units', in: ['mm'] }] });
    pick(row(1), /comparison/, 'is not set');
    pick(row(2), /comparison/, 'is none of');
    expect(seen.value).toEqual({ all: [{ not: { path: 'view.author' } }, { not: { path: 'view.units', in: ['mm'] } }] });
    fireEvent.click(within(row(2)).getByRole('checkbox', { name: 'Inches' }));
    expect((seen.value as { all: PrefCondition[] }).all[1]).toEqual({ not: { path: 'view.units', in: ['mm', 'in'] } });
    pick(row(1), /comparison/, 'is set');
    expect((seen.value as { all: PrefCondition[] }).all[0]).toEqual({ path: 'view.author' });
  });

  it('draws a range as two comparisons of one pref, and edits either without the other', () => {
    const seen = open({ path: 'view.step', atLeast: 1, below: 10 });
    expect(offered(row(1), /Condition 1 comparison 2/)).toEqual(['is below', 'is at most', 'is not']);
    pick(row(1), /Condition 1 comparison 2/, 'is at most');
    expect(seen.value).toEqual({ path: 'view.step', atLeast: 1, atMost: 10 });
    const box = within(row(1)).getByRole('spinbutton', { name: 'Condition 1 value' });
    fireEvent.change(box, { target: { value: '3' } });
    fireEvent.blur(box);
    expect(seen.value).toEqual({ path: 'view.step', atLeast: 3, atMost: 10 });
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Remove condition 1 comparison 2' }));
    expect(seen.value).toEqual({ path: 'view.step', atLeast: 3 });
  });

  it('adds the bound a number\'s row lacks, and offers none once it has both', () => {
    const seen = open({ path: 'view.step', atLeast: 4 });
    fireEvent.click(within(row(1)).getByRole('button', { name: 'Add a bound to condition 1' }));
    expect(seen.value).toEqual({ path: 'view.step', atLeast: 4, atMost: 4 });
    expect(within(row(1)).queryByRole('button', { name: /Add a bound/ })).toBeNull();
  });
});

describe('PrefConditionEditor groups', () => {
  const author: PrefCondition = { path: 'view.author' };
  const small: PrefCondition = { path: 'view.step', below: 2 };

  it('draws a combinator among the rows as a group of its own rows, each with its controls', () => {
    open({ all: [{ path: 'view.grid' }, { any: [author, small] }] });
    expect(quantifier(row(2))).toHaveTextContent('Any of');
    expect(within(screen.getByRole('group', { name: 'Condition 2.1' })).getByRole('button', { name: /pref/ })).toHaveTextContent('Author');
    expect(within(screen.getByRole('group', { name: 'Condition 2.2' })).getByRole('spinbutton')).toHaveValue('2');
  });

  it('edits a row inside a group, and hands the rows beside the group back as they were', () => {
    const grid: PrefCondition = { path: 'view.grid' };
    const seen = open({ all: [grid, { any: [author, small] }] });
    pick(screen.getByRole('group', { name: 'Condition 2.1' }), /comparison/, 'is not set');
    const parts = (seen.value as { all: PrefCondition[] }).all;
    expect(parts[0]).toBe(grid);
    expect(parts[1]).toEqual({ any: [{ not: author }, small] });
    expect((parts[1] as { any: PrefCondition[] }).any[1]).toBe(small);
  });

  it('adds a row to a group, changes its quantifier, and removes it whole', () => {
    const seen = open({ all: [{ path: 'view.grid' }, { any: [author] }] });
    pick(row(2), /Add a condition to condition 2/, /Zoom step/);
    expect((seen.value as { all: PrefCondition[] }).all[1]).toEqual({ any: [author, { path: 'view.step', above: 0 }] });
    quantify('None of', row(2));
    expect((seen.value as { all: PrefCondition[] }).all[1]).toEqual({ not: { any: [author, { path: 'view.step', above: 0 }] } });
    expect(quantifier(row(2))).toHaveTextContent('None of');
    fireEvent.click(within(row(2)).getByRole('button', { name: 'Remove condition 2' }));
    expect(seen.value).toEqual({ path: 'view.grid' });
  });

  it('adds a group at the quantifier its own is not, which holds whatever no rows come to until it has some', () => {
    const seen = open({ all: [{ path: 'view.grid' }, author] });
    fireEvent.click(screen.getByRole('button', { name: 'Add any of rows' }));
    expect((seen.value as { all: PrefCondition[] }).all[2]).toEqual({ any: [] });
    expect(row(3)).toHaveTextContent('No rows, which never holds.');
    fireEvent.click(within(row(3)).getByRole('button', { name: 'Add all of rows to condition 3' }));
    expect((seen.value as { all: PrefCondition[] }).all[2]).toEqual({ any: [{ all: [] }] });
    expect(screen.getByRole('group', { name: 'Condition 3.1' })).toHaveTextContent('No rows, which always holds.');
  });

  it('draws the not of the whole condition as its quantifier, and a not no comparison says as none of one row', () => {
    const seen = open({ not: { all: [{ path: 'view.grid' }, { not: { path: 'view.units', is: 'mm' } }] } });
    expect(quantifier()).toHaveTextContent('Not all of');
    expect(quantifier(row(2))).toHaveTextContent('None of');
    expect(within(screen.getByRole('group', { name: 'Condition 2.1' })).getByRole('button', { name: /value/ })).toHaveTextContent('Millimeters');
    quantify('Any of');
    expect(seen.value).toEqual({ any: [{ path: 'view.grid' }, { not: { path: 'view.units', is: 'mm' } }] });
  });
});

describe('PrefConditionEditor problems', () => {
  it('says what is wrong with a row on that row, and lets it be pointed at a pref the schema has', () => {
    const seen = open({ all: [{ path: 'view.grid' }, { path: 'view.gone', is: 'x' }, { path: 'view.units', is: 'cm' }] });
    expect(row(1)).not.toHaveTextContent(/no leaf|never holds/);
    expect(row(2)).toHaveTextContent('no leaf holds a value at "view.gone"');
    expect(row(3)).toHaveTextContent('"view.units" never holds \'cm\'');
    expect(row(3)).not.toHaveTextContent('view.gone');
    pick(row(2), /pref/, /Author/);
    expect((seen.value as { all: PrefCondition[] }).all[1]).toEqual({ path: 'view.author' });
    expect(row(2)).not.toHaveTextContent('no leaf');
  });

  it('shows what is no condition at all as text with its problem, and writes nothing until it is removed', () => {
    const seen = open({ path: 'view.grid', nope: 1 } as unknown as PrefCondition);
    expect(screen.getByRole('group', { name: 'Shown if' })).toHaveTextContent('not a condition');
    expect(screen.queryByRole('button', { name: /Add a condition/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(seen.value).toBeUndefined();
  });
});

describe('PrefConditionEditor: is one of, with every option unchecked', () => {
  it('keeps the row, holding an empty in, and says on it that it never holds', () => {
    const seen = open({ path: 'view.units', in: ['mm'] });
    expect(row(1)).not.toHaveAttribute('data-invalid');
    fireEvent.click(within(row(1)).getByRole('checkbox', { name: 'Millimeters' }));
    expect(seen.value).toEqual({ path: 'view.units', in: [] });
    expect(row(1)).toHaveAttribute('data-invalid');
    expect(row(1)).toHaveTextContent('"view.units" is one of nothing, which never holds');
    fireEvent.click(within(row(1)).getByRole('checkbox', { name: 'Inches' }));
    expect(row(1)).not.toHaveTextContent('never holds');
  });
});

describe('PrefConditionEditor exclude', () => {
  const names = (list: string[]) => list.map((text) => text.replace(/ ?view\..*$/, ''));

  it('offers no pref at or beneath an excluded path, for a new row or an old one', () => {
    render(<PrefConditionEditor aria-label="Shown if" schema={SCHEMA} exclude={['view.units', 'view.step']}
      value={{ path: 'view.grid', is: true }} onChange={() => {}} />);
    expect(names(offered(screen.getByRole('group', { name: 'Shown if' }), /Add a condition/))).toEqual(['Show grid', 'Author']);
    expect(names(offered(row(1), /pref/))).toEqual(['Show grid', 'Author']);
  });

  it('leaves out everything under an excluded group, and a pref that only starts like the path stays', () => {
    render(<PrefConditionEditor aria-label="Shown if" schema={SCHEMA} exclude={['view']} value={undefined} onChange={() => {}} />);
    expect(within(screen.getByRole('group', { name: 'Shown if' })).getByRole('button', { name: /Add a condition/ })).toBeDisabled();
    cleanup();
    render(<PrefConditionEditor aria-label="Shown if" schema={SCHEMA} exclude={['view.gri']} value={undefined} onChange={() => {}} />);
    expect(offered(screen.getByRole('group', { name: 'Shown if' }), /Add a condition/)).toHaveLength(4);
  });

  it('keeps a row that already reads an excluded path as its controls, with that pref still named', () => {
    render(<PrefConditionEditor aria-label="Shown if" schema={SCHEMA} exclude={['view.units']}
      value={{ path: 'view.units', is: 'mm' }} onChange={() => {}} />);
    expect(within(row(1)).getByRole('button', { name: /pref/ })).toHaveTextContent('Units');
    expect(within(row(1)).getByRole('button', { name: /comparison/ })).toHaveTextContent('is');
  });
});

describe('PrefConditionEditor inside an entry', () => {
  const mode = { kind: 'enum', name: 'Mode', description: '', default: 'ease', options: [{ value: 'ease', label: 'Ease' }, { value: 'hold', label: 'Hold' }] } as PrefLeaf;
  const phases = {
    kind: 'list', name: 'Phases', description: '', default: [],
    item: { kind: 'object', name: 'Phase', description: '', default: {}, children: { mode, length: { kind: 'number', name: 'Length', description: '', default: 0 } } },
  } as PrefList;
  const schema: PrefGroup = { name: 'Root', children: { mode: { ...mode, name: 'Mode' }, phases } };

  function Entry({ start, seen }: { start?: PrefCondition; seen: { value?: PrefCondition } }) {
    const [value, setValue] = useState<PrefCondition | undefined>(start);
    seen.value = value;
    return <PrefConditionEditor aria-label="Enabled if" schema={schema} entryOf={phases} value={value} onChange={setValue} />;
  }
  const openEntry = (start?: PrefCondition) => {
    const seen: { value?: PrefCondition } = {};
    render(<Entry start={start} seen={seen} />);
    return seen;
  };
  const group = () => screen.getByRole('group', { name: 'Enabled if' });

  it('offers the entry\'s own fields first, each named as the entry\'s, and then the root prefs', () => {
    openEntry();
    expect(offered(group(), /Add a condition/)).toEqual(['Mode this Phase: mode', 'Length this Phase: length', 'Mode mode', 'Phases phases']);
  });

  it('writes a test that reads from the entry for a field of it, and one that reads the root for a root pref', () => {
    const seen = openEntry();
    pick(group(), /Add a condition/, 'Mode this Phase: mode');
    expect(seen.value).toEqual({ from: 'item', path: 'mode', is: 'ease' });
    pick(group(), /Add a condition/, 'Mode mode');
    expect(seen.value).toEqual({ all: [{ from: 'item', path: 'mode', is: 'ease' }, { path: 'mode', is: 'ease' }] });
  });

  it('draws a test of the entry on its own field, and keeps reading the entry through an edit', () => {
    const seen = openEntry({ from: 'item', path: 'mode', is: 'hold' });
    expect(within(row(1)).getByRole('button', { name: /pref/ })).toHaveTextContent('this Phase: mode');
    expect(row(1)).not.toHaveAttribute('data-invalid');
    pick(row(1), /comparison/, 'is not');
    expect(seen.value).toEqual({ from: 'item', path: 'mode', isNot: 'hold' });
    pick(row(1), /pref/, 'Length this Phase: length');
    expect(seen.value).toEqual({ from: 'item', path: 'length', above: 0 });
    const box = within(row(1)).getByRole('spinbutton', { name: 'Condition 1 value' });
    fireEvent.change(box, { target: { value: '3' } });
    fireEvent.blur(box);
    expect(seen.value).toEqual({ from: 'item', path: 'length', above: 3 });
  });

  it('says what is wrong with a test of the entry where there is no entry, or no such field', () => {
    openEntry({ from: 'item', path: 'gone' });
    expect(row(1)).toHaveAttribute('data-invalid');
    expect(row(1)).toHaveTextContent('no leaf holds a value at "gone" in the entry');
    cleanup();
    open({ from: 'item', path: 'mode' });
    expect(row(1)).toHaveTextContent('"mode" is read from an entry, and this is inside no list or map');
  });
});
