import { render, screen } from '@testing-library/react';
import { compact } from '@weasel-js/quantity';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

const column = () => ({
  timeout: f.number(100).range(0, 5000).endless('never').label('Timeout'),
  budget: f.number(0).display(compact()).label('Budget'),
});
const schema = resolveConfigSchema(f.schema({ a: f.group(column()) }), []);
const columns: ControlMatrixColumn[] = [{ key: 'a', label: 'A' }];

describe('<ControlMatrix> number cells', () => {
  it('show a number as its row would: its infinity word and its display', () => {
    render(
      <ControlMatrix
        schema={schema}
        columns={columns}
        rows={[{ key: 'timeout' }, { key: 'budget' }]}
        config={{ a: { timeout: Infinity, budget: 2_000_000 } }}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByLabelText('A Timeout', { exact: false })).toHaveTextContent('never');
    expect(screen.getByLabelText('A Budget', { exact: false })).toHaveTextContent('2.00M');
  });
});
