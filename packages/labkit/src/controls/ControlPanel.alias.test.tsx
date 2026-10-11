import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(
  f.schema({
    view: f.group({ grid: f.boolean(false).label('Show grid') }),
    play: f.group({
      grid: f.alias('view.grid'),
      named: f.alias('view.grid').label('Grid while playing'),
      lost: f.alias('view.gone').label('Lost'),
    }),
  }),
  [],
);

describe('<ControlPanel> alias', () => {
  it('builds a leaf that names its target and holds no value', () => {
    expect(schema.group.children.play).toMatchObject({
      children: { grid: { kind: 'alias', of: 'view.grid', name: '', default: undefined } },
    });
  });

  it('draws the target\'s control again, under the target\'s label or its own', () => {
    render(<ControlPanel schema={schema} config={{ view: { grid: true } }} setConfig={vi.fn()} />);
    const boxes = screen.getAllByRole('checkbox', { name: 'Show grid' });
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Grid while playing' })).toBeChecked();
  });

  it('writes the target\'s value from the alias\'s row', () => {
    const setConfig = vi.fn();
    render(<ControlPanel schema={schema} config={{ view: { grid: false } }} setConfig={setConfig} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Grid while playing' }));
    expect(setConfig).toHaveBeenCalledWith('view.grid', true);
  });

  it('says so in place where an alias names no control', () => {
    render(<ControlPanel schema={schema} config={{ view: { grid: false } }} setConfig={vi.fn()} />);
    expect(screen.getByText('(alias: no control at view.gone)')).toBeInTheDocument();
  });
});
