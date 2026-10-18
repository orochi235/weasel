import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> packing', () => {
  const schema = resolveConfigSchema(
    f.schema({ width: f.number(256), title: f.string('a'), tint: f.color('#ff0000') }),
    [],
  );
  const config = { width: 256, title: 'a', tint: '#ff0000' };
  // jsdom lays out no grid, so the class the grid rules key off is the proxy
  // for "these rows pair" — a layout assertion is not available here.
  const list = (container: HTMLElement) => container.querySelector('.lk-control-panel');
  const rowOf = (name: string) => screen.getByLabelText(name).closest('label');

  it('packs two rows to a line by default', () => {
    const { container } = render(
      <ControlPanel schema={schema} config={config} setConfig={vi.fn()} />,
    );
    expect(list(container)?.className).toMatch(/listPairs/);
    expect(rowOf('Width')?.className).not.toMatch(/span/);
  });

  it('gives every row its own line under one-up', () => {
    const { container } = render(
      <ControlPanel schema={schema} config={config} setConfig={vi.fn()} pack="one-up" />,
    );
    expect(list(container)?.className).not.toMatch(/listPairs/);
  });

  it('spans the rows that need the width under auto, and pairs the rest', () => {
    render(<ControlPanel schema={schema} config={config} setConfig={vi.fn()} pack="auto" />);
    expect(rowOf('Title')?.className).toMatch(/span/);
    expect(rowOf('Width')?.className).not.toMatch(/span/);
  });

  it('passes its layout down to the rows', () => {
    render(<ControlPanel schema={schema} config={config} setConfig={vi.fn()} layout="inline" />);
    expect(rowOf('Width')?.className).toMatch(/rowInline/);
  });
});

describe('<ControlPanel> pair', () => {
  const paired = () =>
    resolveConfigSchema(
      f.schema({
        x: f.number(10).label('X').pair({ with: 'y', label: 'Offset' }),
        y: f.number(20).label('Y'),
        scale: f.number(1).label('Scale'),
      }),
      [],
    );
  const config = { x: 10, y: 20, scale: 1 };

  it('draws two leaves sharing a pair id as one row named by the pair', () => {
    render(<ControlPanel schema={paired()} config={config} setConfig={vi.fn()} />);
    const row = screen.getByText('Offset').closest('div') as HTMLElement;
    expect(within(row).getByLabelText('X')).toHaveValue('10');
    expect(within(row).getByLabelText('Y')).toHaveValue('20');
  });

  it('captions each cell of a pair with its own name, so a paired switch is not left unnamed', () => {
    render(<ControlPanel schema={paired()} config={config} setConfig={vi.fn()} />);
    const row = screen.getByText('Offset').closest('div') as HTMLElement;
    expect(within(row).getByText('X')).toHaveClass('lk-pair-label');
    expect(within(row).getByText('Y')).toHaveClass('lk-pair-label');
  });

  it('writes each cell of a paired row to its own path', () => {
    const setConfig = vi.fn();
    render(<ControlPanel schema={paired()} config={config} setConfig={setConfig} />);
    fireEvent.change(screen.getByLabelText('Y'), { target: { value: '30' } });
    fireEvent.blur(screen.getByLabelText('Y'));
    expect(setConfig).toHaveBeenCalledWith('y', 30);
  });

  it('keeps a segmented leaf segmented when it shares a row, and gives that row the width', () => {
    const schema = resolveConfigSchema(
      f.schema({
        camera: f
          .enum<'2d' | '3d'>('3d', ['2d', '3d'])
          .radio()
          .label('')
          .pair({ with: 'hold', label: 'Camera' }),
        hold: f.boolean(true).toggle().label('Hold front'),
      }),
      [],
    );
    render(
      <ControlPanel schema={schema} config={{ camera: '3d', hold: true }} setConfig={vi.fn()} />,
    );
    const row = screen.getByText('Camera').closest('div') as HTMLElement;
    expect(within(row).getByRole('radio', { name: '2d' })).toBeInTheDocument();
    expect(within(row).queryByRole('combobox')).toBeNull();
    expect(row.className).toMatch(/span/);
  });

  it('leaves an unpaired sibling on its own row', () => {
    render(<ControlPanel schema={paired()} config={config} setConfig={vi.fn()} />);
    const row = screen.getByText('Offset').closest('div') as HTMLElement;
    expect(within(row).queryByLabelText('Scale')).toBeNull();
    expect(screen.getByLabelText('Scale')).toHaveValue('1');
  });
});
