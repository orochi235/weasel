import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

afterEach(cleanup);

type Ease = { steps: number } | string;
const column = () => ({
  delay: f.number(0).label('Delay'),
  ease: f.custom<Ease>('ease', 'linear').label('Ease'),
  curve: f
    .custom<Ease>('ease', 'linear')
    .label('Curve')
    .dialog(() => null, { summary: (v) => `curve: ${typeof v === 'string' ? v : 'steps'}` }),
});
const schema = resolveConfigSchema(f.schema({ a: f.group(column()), b: f.group(column()) }), []);
const columns: ControlMatrixColumn[] = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
];
const config = {
  a: { delay: 0, ease: 'linear', curve: 'linear' },
  b: { delay: 10, ease: { steps: 4 }, curve: { steps: 2 } },
};

describe('<ControlMatrix> summaries', () => {
  it("shows a custom leaf's cell through the row's summary", () => {
    render(
      <ControlMatrix
        schema={schema}
        columns={columns}
        rows={[{ key: 'ease', summary: (v) => (typeof v === 'string' ? v : `${(v as { steps: number }).steps} steps`) }]}
        config={config}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'A Ease' })).toHaveTextContent('linear');
    expect(screen.getByRole('button', { name: 'B Ease' })).toHaveTextContent('4 steps');
  });

  it("falls back to the summary the leaf's .dialog declares", () => {
    render(
      <ControlMatrix
        schema={schema}
        columns={columns}
        rows={[{ key: 'curve' }]}
        config={config}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'B Curve' })).toHaveTextContent('curve: steps');
  });
});

describe('<ControlMatrix inherit={false}>', () => {
  const grid = (setConfig = vi.fn()) => {
    render(
      <ControlMatrix
        schema={schema}
        columns={columns}
        rows={[{ key: 'delay' }]}
        config={config}
        inherit={false}
        setConfig={setConfig}
      />,
    );
    return setConfig;
  };

  it('needs no auto set, and draws no column as the fallback', () => {
    const { container } = render(
      <ControlMatrix schema={schema} columns={columns} rows={[{ key: 'delay' }]} config={config} inherit={false} setConfig={() => {}} />,
    );
    expect(container.querySelector('.is-first')).toBeNull();
    expect(container.querySelector('.is-inherited')).toBeNull();
  });

  it('offers no Inherit in a cell it opens, and Alt-click unpins nothing', () => {
    const setConfig = grid();
    const cell = screen.getByRole('button', { name: 'B Delay' });
    fireEvent.click(cell, { altKey: true });
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.click(cell);
    expect(screen.queryByRole('button', { name: 'Inherit' })).toBeNull();
  });
});
