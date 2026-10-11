import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

const look = () => ({
  background: f.boolean(true).label('Background'),
  fill: f.color('#336699').label('Fill'),
  glow: f.number(0.25).range(0, 1).step(0.05).label('Glow').describe('Halo around the shape.'),
  shading: f.enum('flat', [
    { value: 'flat', label: 'Flat' },
    { value: 'soft', label: 'Soft' },
  ]),
});

const schema = resolveConfigSchema(
  f.schema({
    looks: f.group({
      defaults: f.group(look()),
      window: f.group(look()),
      // An arrow has no fill.
      arrow: f.group({ background: look().background, glow: look().glow, shading: look().shading }),
    }),
  }),
  [],
);

const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
  { key: 'looks.arrow', label: 'Arr', title: 'Arrow' },
];
const rows = [{ key: 'background' }, { key: 'fill' }, { key: 'glow' }, { key: 'shading' }];

const value = { background: true, fill: '#336699', glow: 0.25, shading: 'flat' };
const config = {
  looks: {
    defaults: value,
    window: { ...value, glow: 0.5 },
    arrow: { background: true, glow: 0.25, shading: 'soft' },
  },
};

function setup(over: Partial<Parameters<typeof ControlMatrix>[0]> = {}) {
  const setConfig = vi.fn();
  const utils = render(
    <ControlMatrix
      schema={schema}
      columns={columns}
      rows={rows}
      config={config}
      auto={new Set(['looks.window.background', 'looks.window.fill', 'looks.arrow.glow'])}
      setConfig={setConfig}
      {...over}
    />,
  );
  return { setConfig, ...utils };
}

const cell = (name: string) => screen.getByLabelText(name, { exact: false });

describe('<ControlMatrix>', () => {
  it('draws a table of settings by scopes, labels from the schema', () => {
    setup();
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Def', 'Win', 'Arr']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['Background', 'Fill', 'Glowⓘ', 'Shading']);
    // The row's help takes no focus of its own: the row's first control carries it.
    expect(screen.queryByRole('button', { name: 'About Glow' })).toBeNull();
    expect(screen.getByText('ⓘ').closest('tr')?.querySelector('[aria-describedby]')).not.toBeNull();
  });

  it('shows numbers at their step precision and enums by label', () => {
    setup();
    expect(cell('Defaults Glow').textContent).toBe('0.25');
    expect(cell('Window Glow').textContent).toBe('0.50');
    expect(cell('Arrow Shading').textContent).toBe('Soft');
  });

  it('draws a dash for a scope with no such setting', () => {
    setup();
    const none = screen.getByLabelText('Arrow has no Fill');
    expect(none.textContent).toBe('—');
    expect(none.closest('td')?.className).toMatch(/is-missing/);
    expect(none.closest('td')?.querySelector('button, input')).toBeNull();
  });

  it('ghosts an inherited cell and names where it inherits from', () => {
    setup();
    const inherited = screen.getByRole('switch', { name: 'Window Background, from Defaults' });
    expect(inherited.closest('td')?.className).toMatch(/is-inherited/);
    const pinned = screen.getByRole('switch', { name: 'Defaults Background' });
    expect(pinned.closest('td')?.className).not.toMatch(/is-inherited/);
  });

  it('takes the inherit hint from a prop', () => {
    setup({ inheritHint: (c) => `${c.title} follows the default` });
    expect(
      screen.getByRole('switch', { name: 'Window Background, Window follows the default' }),
    ).toBeTruthy();
  });

  it('flips a boolean in place, which pins it', () => {
    const { setConfig } = setup();
    fireEvent.click(screen.getByRole('switch', { name: /^Window Background/ }));
    expect(setConfig).toHaveBeenCalledWith('looks.window.background', false);
  });

  it('opens a color picker in place, which pins it', () => {
    const { setConfig } = setup();
    const swatch = cell('Window Fill') as HTMLInputElement;
    expect(swatch.type).toBe('color');
    fireEvent.change(swatch, { target: { value: '#ff0000' } });
    expect(setConfig).toHaveBeenCalledWith('looks.window.fill', '#ff0000');
  });

  it('draws an unset color as unset, and clears a set one from its popover', () => {
    const edge = resolveConfigSchema(
      f.schema({
        a: f.group({ edge: f.color('').label('Edge') }),
        b: f.group({ edge: f.color('').label('Edge') }),
      }),
      [],
    );
    const setConfig = vi.fn();
    render(
      <ControlMatrix
        schema={edge}
        columns={[
          { key: 'a', label: 'A', title: 'Alpha' },
          { key: 'b', label: 'B', title: 'Beta' },
        ]}
        rows={[{ key: 'edge' }]}
        config={{ a: { edge: null }, b: { edge: '#ff0000' } }}
        auto={new Set()}
        setConfig={setConfig}
      />,
    );
    expect(screen.getByRole('button', { name: 'Alpha Edge, unset' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Edge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(setConfig).toHaveBeenCalledWith('b.edge', null);
  });

  it('edits any other cell in a popover holding the panel control, which pins it', () => {
    const { setConfig } = setup();
    fireEvent.click(cell('Window Glow'));
    const dialog = screen.getByRole('dialog', { name: 'Window Glow' });
    fireEvent.change(within(dialog).getByRole('slider'), { target: { value: '0.75' } });
    expect(setConfig).toHaveBeenCalledWith('looks.window.glow', 0.75);
  });

  it('lists an enum cell’s options in its popover, with no dropdown inside, and closes on a choice', () => {
    const { setConfig } = setup();
    fireEvent.click(cell('Window Shading'));
    const dialog = screen.getByRole('dialog', { name: 'Window Shading' });
    expect(within(dialog).queryByRole('button', { name: /Shading/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Soft' }));
    expect(setConfig).toHaveBeenCalledWith('looks.window.shading', 'soft');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unpins from the popover with Inherit, disabled while already inherited', () => {
    const { setConfig, unmount } = setup();
    fireEvent.click(cell('Window Glow'));
    const inherit = screen.getByRole('button', { name: 'Inherit' });
    expect(inherit).not.toBeDisabled();
    fireEvent.click(inherit);
    expect(setConfig).toHaveBeenCalledWith('looks.window.glow', auto);
    unmount();

    setup();
    fireEvent.click(cell('Arrow Glow'));
    expect(screen.getByRole('button', { name: 'Inherit' })).toBeDisabled();
  });

  it('has no Inherit for the fallback column', () => {
    setup();
    fireEvent.click(cell('Defaults Glow'));
    expect(screen.getByRole('dialog', { name: 'Defaults Glow' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inherit' })).toBeNull();
  });

  it('unpins a pinned cell on Alt-click, without flipping or opening it', () => {
    const { setConfig } = setup();
    fireEvent.click(cell('Window Glow'), { altKey: true });
    expect(setConfig).toHaveBeenCalledWith('looks.window.glow', auto);
    expect(screen.queryByRole('dialog')).toBeNull();

    setConfig.mockClear();
    fireEvent.click(screen.getByRole('switch', { name: 'Defaults Background' }), { altKey: true });
    fireEvent.click(screen.getByRole('switch', { name: /^Window Background/ }), { altKey: true });
    // The fallback cannot inherit, and an inherited cell is already unpinned.
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('calls onColumnClick from a header button', () => {
    const onColumnClick = vi.fn();
    setup({ onColumnClick });
    fireEvent.click(screen.getByRole('button', { name: 'Window' }));
    expect(onColumnClick).toHaveBeenCalledWith(columns[1]);
  });

  it('draws plain headers without onColumnClick', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Window' })).toBeNull();
  });
});
