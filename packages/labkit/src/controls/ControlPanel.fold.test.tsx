import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix } from './ControlMatrix';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48) }), []);

describe('<ControlPanel> folding the whole panel', () => {
  it('folds from the title twisty and reports it under the root key', () => {
    const onCollapse = vi.fn();
    render(
      <ControlPanel
        title="Layout"
        collapsible
        schema={schema}
        config={{ gap: 12 }}
        setConfig={() => {}}
        onCollapse={onCollapse}
      />,
    );
    const twisty = screen.getByRole('button', { name: 'Layout' });
    expect(twisty).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(twisty);
    expect(onCollapse).toHaveBeenCalledWith('', true);
    expect(twisty).toHaveAttribute('aria-expanded', 'false');
  });

  it('reads a controlled panel fold from the root key, beside the sections', () => {
    render(
      <ControlPanel
        title="Layout"
        collapsible
        schema={schema}
        config={{ gap: 12 }}
        setConfig={() => {}}
        collapsed={{ '': true }}
        onCollapse={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Layout' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('draws no panel twisty unless asked, whatever the sections do', () => {
    render(
      <ControlPanel
        title="Layout"
        collapse="closed"
        schema={schema}
        config={{ gap: 12 }}
        setConfig={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Layout' })).toBeNull();
  });
});

describe('<ControlMatrix> folding', () => {
  const matrix = (props: Partial<Parameters<typeof ControlMatrix>[0]>) => (
    <ControlMatrix
      schema={resolveConfigSchema(f.schema({ a: f.group({ gap: f.number(1) }) }), [])}
      columns={[{ key: 'a', label: 'Def', title: 'Defaults' }]}
      rows={[{ key: 'gap' }]}
      config={{ a: { gap: 1 } }}
      auto={new Set()}
      setConfig={() => {}}
      onColumnClick={() => {}}
      {...props}
    />
  );

  it('starts folded when told to', () => {
    render(matrix({ title: 'Looks', defaultCollapsed: true }));
    expect(screen.getByRole('button', { name: 'Looks' })).toHaveAttribute('aria-expanded', 'false');
  });

  it("draws a titled matrix's column headers in the title row, and none while it is folded", () => {
    render(matrix({ title: 'Looks', collapsible: true }));
    const head = screen.getByRole('button', { name: 'Defaults' });
    expect(head.closest('table')).toBeNull();
    expect(head.parentElement?.parentElement).toHaveClass('lk-control-matrix__heads');
    // The table keeps a header row to name its column.
    expect(screen.getByRole('columnheader', { name: 'Defaults' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Looks' }));
    expect(screen.queryByRole('button', { name: 'Defaults' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Looks' }));
    expect(screen.getByRole('button', { name: 'Defaults' })).toBeInTheDocument();
  });

  it('keeps the headers in the table of a matrix with no title', () => {
    render(matrix({}));
    expect(screen.getByRole('button', { name: 'Defaults' }).closest('table')).not.toBeNull();
  });
});
