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
  it('starts folded when told to', () => {
    render(
      <ControlMatrix
        title="Looks"
        defaultCollapsed
        schema={resolveConfigSchema(f.schema({ a: f.group({ gap: f.number(1) }) }), [])}
        columns={[{ key: 'a', label: 'A', title: 'A' }]}
        rows={[{ key: 'gap' }]}
        config={{ a: { gap: 1 } }}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Looks' })).toHaveAttribute('aria-expanded', 'false');
  });
});
