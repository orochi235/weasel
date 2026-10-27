import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLocus } from '@weasel-js/prefs';
import { PrefsForm, type PrefsFormProps } from './index';

afterEach(cleanup);

const MODE = 'look.mode';
const DENSITY = 'look.density';

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    look: {
      name: 'Look',
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
        },
        density: {
          kind: 'enum', name: 'Density', description: '', default: 'compact',
          options: [{ value: 'compact', label: 'Compact' }, { value: 'roomy', label: 'Roomy' }],
        },
      },
    },
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, splitBy: [MODE, DENSITY] },
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
};

const byMode = (dark: unknown, light: unknown): PrefLocus => ({ $by: MODE, $of: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown): PrefLocus => ({ $by: DENSITY, $of: { compact, roomy } });

function mount(props: Partial<PrefsFormProps> = {}) {
  const on = { onChange: vi.fn(), onSplit: vi.fn(), onJoin: vi.fn(), onChangeAt: vi.fn() };
  const view = render(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 4 }} {...on} {...props} />);
  return { ...on, ...view };
}

const type = (field: HTMLElement, value: string): void => {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
};

/** A form's markup with the ids a control mints for itself left out: they count up from one render to the next. */
const markup = (ui: ReactElement): string => {
  const html = render(ui).container.innerHTML.replace(/ (id|for|aria-labelledby|aria-describedby|aria-controls)="[^"]*"/g, '');
  cleanup();
  return html;
};

describe('a split value in PrefsForm', () => {
  it('names the option the selector is set to beside the label', () => {
    const { rerender, onChange } = mount({ loci: new Map([['gap', byMode(4, 8)]]) });
    expect(screen.getByTitle('Mode: Dark')).toHaveTextContent('Dark');
    rerender(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 8, look: { mode: 'light' } }} onChange={onChange}
      loci={new Map([['gap', byMode(4, 8)]])} />);
    expect(screen.getByTitle('Mode: Light')).toHaveTextContent('Light');
  });

  it('draws no marker for a leaf that is not split', () => {
    mount();
    expect(screen.queryByTitle(/^Mode: /)).toBeNull();
  });

  it('writes through onChange from the collapsed row', () => {
    const { onChange, onChangeAt } = mount({ loci: new Map([['gap', byMode(4, 8)]]) });
    expect(screen.getByRole('spinbutton', { name: 'Gap' })).toHaveValue('4');
    type(screen.getByRole('spinbutton', { name: 'Gap' }), '12');
    expect(onChange).toHaveBeenCalledWith('gap', 12);
    expect(onChangeAt).not.toHaveBeenCalled();
  });

  it('offers a split by each selector the value is not split by, and a join of each it is', () => {
    const { onSplit, onJoin, rerender, onChange } = mount();
    const toggle = screen.getByRole('button', { name: 'Split Gap' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Split by Mode' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: /^Join / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Split by Mode' }));
    expect(onSplit).toHaveBeenCalledWith('gap', MODE);
    fireEvent.click(screen.getByRole('button', { name: 'Split by Density' }));
    expect(onSplit).toHaveBeenLastCalledWith('gap', DENSITY);

    rerender(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 4 }} onChange={onChange} onSplit={onSplit} onJoin={onJoin}
      loci={new Map([['gap', byMode(4, 8)]])} />);
    expect(screen.getByRole('button', { name: 'Gap by Mode' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'Split by Mode' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Split by Density' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Join Mode' }));
    expect(onJoin).toHaveBeenCalledWith('gap', MODE);
  });

  it('leaves the name of the row’s control alone, which the marks and the control beside them would otherwise join', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: {
        look: SCHEMA.children.look!,
        align: {
          kind: 'enum', name: 'Align', description: '', default: 'tight', splitBy: [MODE],
          options: [{ value: 'tight', label: 'Tight' }, { value: 'loose', label: 'Loose' }],
        },
      },
    };
    mount({ schema, values: {}, loci: new Map([['align', byMode('tight', 'loose')]]) });
    expect(screen.getByRole('button', { name: 'Tight Align' })).toBeTruthy();
  });

  it('keeps a row that can be split a label, so an app renderer’s control is named by it and the toggle after it', () => {
    const plain = Object.assign(
      ({ value, setValue }: { value: unknown; setValue: (v: unknown) => void }) => (
        <input value={String(value)} onChange={(e) => setValue(Number(e.target.value))} />
      ),
      {},
    );
    mount({ loci: new Map([['gap', byMode(4, 8)]]), renderers: { number: plain } });
    const field = screen.getByRole('textbox', { name: /^Gap\b/ });
    const row = field.closest('label');
    expect(row).not.toBeNull();
    const toggle = within(row!).getByRole('button', { name: 'Gap by Mode' });
    expect(field.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(row!).getByText('Gap'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens to one control per option, each named for the leaf and the option and showing its member', () => {
    mount({ loci: new Map([['gap', byMode(4, 8)]]) });
    const toggle = screen.getByRole('button', { name: 'Gap by Mode' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Gap by Mode' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const members = screen.getByRole('group', { name: 'Gap by Mode' });
    expect(within(members).getAllByRole('spinbutton')).toHaveLength(2);
    expect(within(members).getByRole('spinbutton', { name: 'Gap, Dark' })).toHaveValue('4');
    expect(within(members).getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('8');
    fireEvent.click(toggle);
    expect(screen.queryByRole('group', { name: 'Gap by Mode' })).toBeNull();
  });

  it('writes the one member edited, and nothing through onChange', () => {
    const { onChange, onChangeAt } = mount({ loci: new Map([['gap', byMode(4, 8)]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    type(screen.getByRole('spinbutton', { name: 'Gap, Light' }), '20');
    expect(onChangeAt).toHaveBeenCalledTimes(1);
    expect(onChangeAt).toHaveBeenCalledWith('gap', 20, { [MODE]: 'light' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('nests a second selector under each option of the first', () => {
    const { onChangeAt } = mount({ loci: new Map([['gap', byMode(byDensity(1, 2), byDensity(3, 5))]]) });
    expect(screen.getByTitle('Mode: Dark')).toBeTruthy();
    expect(screen.getByTitle('Density: Compact')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode and Density' }));
    const members = screen.getByRole('group', { name: 'Gap by Mode and Density' });
    const light = within(members).getByRole('group', { name: 'Light' });
    expect(within(light).getAllByRole('spinbutton')).toHaveLength(2);
    expect(within(light).getByRole('spinbutton', { name: 'Gap, Light, Compact' })).toHaveValue('3');
    expect(within(members).getByRole('spinbutton', { name: 'Gap, Dark, Roomy' })).toHaveValue('2');
    type(within(light).getByRole('spinbutton', { name: 'Gap, Light, Roomy' }), '9');
    expect(onChangeAt).toHaveBeenCalledWith('gap', 9, { [MODE]: 'light', [DENSITY]: 'roomy' });
  });

  it('shows the default for an option the locus holds nothing for', () => {
    mount({ loci: new Map([['gap', { $by: MODE, $of: { dark: 9 } }]]), values: { gap: 9 } });
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    expect(screen.getByRole('spinbutton', { name: 'Gap, Dark' })).toHaveValue('9');
    expect(screen.getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('4');
  });

  it('draws a leaf with no splitBy as it did, whatever the form is given', () => {
    const plain: PrefGroup = { name: 'Prefs', children: { name: SCHEMA.children.name! } };
    const bare = markup(<PrefsForm schema={plain} layout="list" values={{}} onChange={vi.fn()} />);
    const given = markup(<PrefsForm schema={plain} layout="list" values={{}} onChange={vi.fn()} onSplit={vi.fn()} onJoin={vi.fn()}
      onChangeAt={vi.fn()} loci={new Map([['name', byMode('a', 'b')]])} />);
    expect(given).toBe(bare);
  });

  it('draws a leaf that may be split as it did in a form given nothing to split with', () => {
    const never: PrefGroup = { ...SCHEMA, children: { ...SCHEMA.children, gap: { ...SCHEMA.children.gap!, splitBy: undefined } as never } };
    const bare = markup(<PrefsForm schema={never} layout="list" values={{ gap: 4 }} onChange={vi.fn()} />);
    const given = markup(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 4 }} onChange={vi.fn()} />);
    expect(given).toBe(bare);
  });

  it('starts with the rows named open, which the reader can then shut', () => {
    mount({ loci: new Map([['gap', byMode(4, 8)]]), defaultSplitOpen: ['gap'] });
    expect(screen.getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('8');
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    expect(screen.queryByRole('spinbutton', { name: 'Gap, Light' })).toBeNull();
  });

  it('stays open by path when the locus it shows is replaced', () => {
    const { rerender, onChange, onChangeAt } = mount({ loci: new Map([['gap', byMode(4, 8)]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    rerender(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 4 }} onChange={onChange} onChangeAt={onChangeAt}
      loci={new Map([['gap', byMode(4, 30)]])} />);
    expect(screen.getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('30');
  });
});

describe('a split value where the row has no members to open', () => {
  it('marks a mixed row, and opens it to its split and joins alone', () => {
    mount({ loci: new Map([['gap', byMode(4, 8)]]), mixed: new Set(['gap']) });
    expect(screen.getByTitle('Mode: Dark')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    expect(screen.getByRole('button', { name: 'Join Mode' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Gap by Mode' })).queryByRole('spinbutton')).toBeNull();
  });

  it('draws no members in a form that cannot write one', () => {
    mount({ loci: new Map([['gap', byMode(4, 8)]]), onChangeAt: undefined, defaultSplitOpen: ['gap'] });
    expect(screen.getByRole('button', { name: 'Join Mode' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Gap by Mode' })).queryByRole('spinbutton')).toBeNull();
  });

  it('has nothing to open in a form given the loci and nothing to change them with', () => {
    render(<PrefsForm schema={SCHEMA} layout="list" values={{ gap: 4 }} onChange={vi.fn()} loci={new Map([['gap', byMode(4, 8)]])} />);
    expect(screen.getByTitle('Mode: Dark')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gap by Mode' })).toBeNull();
  });

  it('marks a leaf drawn in the heading of its group, and offers nothing there', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: {
        look: SCHEMA.children.look!,
        shadow: {
          name: 'Shadow',
          children: {
            on: { kind: 'boolean', name: 'Shadow on', description: '', default: true, control: 'switch', heading: true, splitBy: [MODE] },
            blur: { kind: 'number', name: 'Blur', description: '', default: 4 },
          },
        },
      },
    };
    mount({ schema, values: {}, loci: new Map([['shadow.on', byMode(true, false)]]) });
    expect(within(screen.getByRole('heading', { name: /Shadow/ })).getByTitle('Mode: Dark')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /by Mode$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join Mode' })).toBeNull();
  });

  it('marks a leaf drawn in a bar, and offers nothing there', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: {
        look: SCHEMA.children.look!,
        tools: { name: 'Tools', as: 'bar', children: { gap: SCHEMA.children.gap! } },
      },
    };
    mount({ schema, values: {}, loci: new Map([['tools.gap', byMode(4, 8)]]) });
    expect(screen.getByTitle('Mode: Dark')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gap by Mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join Mode' })).toBeNull();
  });
});

describe('a split value under what else shapes a row', () => {
  it('takes no split, join, or member edit on a row a condition disables', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: {
        ...SCHEMA.children,
        on: { kind: 'boolean', name: 'On', description: '', default: false },
        gap: { ...SCHEMA.children.gap!, enableIf: { path: 'on' } } as never,
      },
    };
    const { onSplit, onJoin } = mount({ schema, loci: new Map([['gap', byMode(4, 8)]]), defaultSplitOpen: ['gap'] });
    const join = screen.getByRole('button', { name: 'Join Mode' });
    expect(join).toBeDisabled();
    fireEvent.click(join);
    fireEvent.click(screen.getByRole('button', { name: 'Split by Density' }));
    expect(onJoin).not.toHaveBeenCalled();
    expect(onSplit).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton', { name: 'Gap, Light' })).toBeDisabled();
  });

  it('opens an object leaf to one object per option, an edit of a field writing that member whole', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: {
        look: SCHEMA.children.look!,
        edge: {
          kind: 'object', name: 'Edge', description: '', default: { width: 1, inset: 0 }, splitBy: [MODE],
          children: {
            width: { kind: 'number', name: 'Width', description: '', default: 1 },
            inset: { kind: 'number', name: 'Inset', description: '', default: 0 },
          },
        } as never,
      },
    };
    const { onChangeAt } = mount({ schema, values: {}, loci: new Map([['edge', byMode({ width: 1, inset: 0 }, { width: 3, inset: 2 })]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Edge by Mode' }));
    const members = screen.getByRole('group', { name: 'Edge by Mode' });
    const widths = within(members).getAllByRole('spinbutton', { name: 'Width' });
    expect(widths.map((w) => (w as HTMLInputElement).value)).toEqual(['1', '3']);
    type(widths[1]!, '5');
    expect(onChangeAt).toHaveBeenCalledWith('edge', { width: 5, inset: 2 }, { [MODE]: 'light' });
  });

  it('draws the marks of a block leaf on a line over its control, and what it opens to under it', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: { ...SCHEMA.children, gap: { ...SCHEMA.children.gap!, block: true } as never },
    };
    const { onSplit } = mount({ schema, loci: new Map([['gap', byMode(4, 8)]]) });
    expect(screen.getByTitle('Mode: Dark')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gap by Mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Split by Density' }));
    expect(onSplit).toHaveBeenCalledWith('gap', DENSITY);
    expect(screen.getByRole('spinbutton', { name: 'Gap, Light' })).toHaveValue('8');
  });

  it('hands an app renderer each member as it hands it the leaf', () => {
    const schema: PrefGroup = {
      ...SCHEMA,
      children: { look: SCHEMA.children.look!, odd: { kind: 'odd', name: 'Odd', description: '', default: 1, splitBy: [MODE] } as never },
    };
    const { onChangeAt } = mount({
      schema, values: { odd: 2 }, loci: new Map([['odd', byMode(2, 3)]]),
      renderers: { odd: (ctx) => <button type="button" onClick={() => ctx.setValue(7)}>{ctx.pref.name}: {String(ctx.value)}</button> },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Odd by Mode' }));
    fireEvent.click(screen.getByText('Odd, Light: 3'));
    expect(onChangeAt).toHaveBeenCalledWith('odd', 7, { [MODE]: 'light' });
  });
});

describe('the control that opens a split row', () => {
  it('points at the group it opens, and at nothing while the row is closed', () => {
    const SCHEMA: PrefGroup = {
      name: 'Test',
      children: {
        mode: { kind: 'enum', name: 'Mode', description: '', default: 'dark', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] },
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, splitBy: ['mode'] },
      },
    };
    const loci = new Map([['gap', { $by: 'mode', $of: { dark: 4, light: 8 } }]]);
    render(<PrefsForm schema={SCHEMA} values={{ mode: 'dark', gap: 4 }} onChange={() => {}} loci={loci} onChangeAt={() => {}} onJoin={() => {}} />);
    const toggle = screen.getByRole('button', { name: /Gap/, expanded: false });
    expect(toggle.getAttribute('aria-controls')).toBeNull();
    fireEvent.click(toggle);
    const open = screen.getByRole('button', { name: /Gap/, expanded: true });
    const body = document.getElementById(open.getAttribute('aria-controls')!);
    expect(body?.getAttribute('role')).toBe('group');
    expect(body?.contains(screen.getByRole('button', { name: 'Join Mode' }))).toBe(true);
  });
});
