import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { ControlRenderer } from '../config/types';
import { ControlPanel } from './ControlPanel';

const on = { path: 'on' };

function panel(
  nodes: Parameters<typeof f.schema>[0],
  config: Record<string, unknown>,
  controls?: Record<string, ControlRenderer>,
) {
  const schema = resolveConfigSchema(f.schema(nodes), []);
  return render(
    <ControlPanel schema={schema} config={config} setConfig={vi.fn()} renderers={controls} />,
  );
}

describe('<ControlPanel> enableIf', () => {
  it('disables a row whose condition fails, as data and as a function, and marks the row', () => {
    panel(
      {
        on: f.boolean(false).label('On'),
        size: f.number(3).label('Size').enableIf(on),
        blur: f
          .number(4)
          .range(0, 10)
          .slider()
          .label('Blur')
          .enableIf((c) => c.on === true),
        name: f.string('x').label('Name').enableIf(on),
        mode: f.enum('a', ['a', 'b']).label('Mode').enableIf(on),
        go: f
          .action(() => {})
          .label('Go')
          .enableIf(on),
      },
      { on: false, size: 3, blur: 4, name: 'x', mode: 'a' },
    );
    const size = screen.getByRole('spinbutton', { name: 'Size' });
    expect(size).toBeDisabled();
    expect(size.closest('[data-property-row][data-disabled]')).not.toBeNull();
    expect(screen.getByRole('slider', { name: 'Blur' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    const select = screen
      .getAllByRole('button', { name: /Mode/ })
      .find((el) => el.getAttribute('aria-haspopup') === 'listbox');
    expect(select).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'On' })).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'On' }).closest('[data-property-row][data-disabled]'),
    ).toBeNull();
  });

  it('leaves the row enabled while the condition holds', () => {
    panel(
      { on: f.boolean(true).label('On'), size: f.number(3).label('Size').enableIf(on) },
      { on: true, size: 3 },
    );
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeEnabled();
  });

  it('disables every row of a group whose condition fails', () => {
    panel(
      {
        on: f.boolean(false).label('On'),
        grid: f
          .group({ size: f.number(3).label('Size'), fine: f.boolean(true).label('Fine') })
          .label('Grid')
          .enableIf(on),
      },
      { on: false, grid: { size: 3, fine: true } },
    );
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Fine' })).toBeDisabled();
  });

  it('disables the cells of a paired row and of a bar', () => {
    panel(
      {
        on: f.boolean(false).label('On'),
        x: f.number(1).label('X').pair({ with: 'y', label: 'Place' }).enableIf(on),
        y: f.number(2).label('Y').enableIf(on),
        tools: f
          .group({ step: f.number(1).label('Step') })
          .as('bar')
          .enableIf(on),
      },
      { on: false, x: 1, y: 2, tools: { step: 1 } },
    );
    for (const name of ['X', 'Y', 'Step'])
      expect(screen.getByRole('spinbutton', { name })).toBeDisabled();
  });

  it('disables the button of a row that opens a dialog', () => {
    panel(
      {
        on: f.boolean(false).label('On'),
        tags: f.list(['a'], f.string('')).label('Tags').enableIf(on),
      },
      { on: false, tags: ['a'] },
    );
    const edit = screen.getByRole('button', { name: 'Edit Tags' });
    expect(edit).toBeDisabled();
    fireEvent.click(edit);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tells a custom control', () => {
    const seen: Array<boolean | undefined> = [];
    const size: ControlRenderer = (ctx) => {
      seen.push(ctx.disabled);
      return <span>own</span>;
    };
    panel(
      { on: f.boolean(false).label('On'), size: f.number(3).label('Size').enableIf(on) },
      { on: false, size: 3 },
      { size },
    );
    expect(seen.at(-1)).toBe(true);
  });
});
