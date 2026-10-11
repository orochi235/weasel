import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> rows', () => {
  it('keeps a paired leaf that is not one control on a row of its own', () => {
    const run = vi.fn();
    const schema = resolveConfigSchema(
      f.schema({
        wipe: f.action(run).label('Wipe').pair({ with: 'count', label: 'Run' }),
        count: f.number(3).label('Count'),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ count: 3 }} setConfig={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Count')).toHaveValue('3');
  });

  it('keeps a paired list on a row that opens it', () => {
    const schema = resolveConfigSchema(
      f.schema({
        tags: f.list(['a'], f.string('')).label('Tags').pair({ with: 'count', label: 'Run' }),
        count: f.number(3).label('Count'),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ tags: ['a'], count: 3 }} setConfig={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit Tags' })).toBeInTheDocument();
  });

  it('does not run an action when its label is clicked', async () => {
    const run = vi.fn();
    const schema = resolveConfigSchema(f.schema({ wipe: f.action(run).label('Wipe') }), []);
    render(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Wipe' });
    const row = button.closest('[class*="row"]') as HTMLElement;
    await userEvent.click(
      within(row)
        .getAllByText('Wipe')
        .find((el) => el !== button && !button.contains(el)) as HTMLElement,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('offers no auto toggle on a row whose unpinning would close a resolver cycle', async () => {
    const schema = resolveConfigSchema(
      f.schema({
        a: f
          .number(1)
          .label('A')
          .auto((c) => (c.b as number) + 1),
        b: f
          .number(2)
          .label('B')
          .auto((c) => (c.a as number) + 1),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ a: 1, b: 2 }} setConfig={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /A/ }));
    // A is auto now; B reading A while A reads B has no answer.
    expect(screen.queryByRole('button', { name: /B/ })).toBeNull();
    expect(screen.getByLabelText('B')).toHaveValue('2');
  });
});
