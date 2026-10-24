import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

describe('<ControlPanel> visibility and sections', () => {
  it('hides a row whose showIf is false', () => {
    const schema = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        cellSize: f.number(20).showIf((c) => c.showGrid === true),
      }),
      [],
    );
    const { rerender } = renderWithIcons(
      <ControlPanel
        schema={schema}
        config={{ showGrid: true, cellSize: 20 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Cell size')).toBeInTheDocument();
    rerender(
      <ControlPanel
        schema={schema}
        config={{ showGrid: false, cellSize: 20 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Cell size')).not.toBeInTheDocument();
  });

  it('keeps a hidden leaf out unless asked for it', () => {
    const schema = resolveConfigSchema(f.schema({ seed: f.number(0).hidden() }), []);
    const { rerender } = renderWithIcons(
      <ControlPanel schema={schema} config={{ seed: 0 }} setConfig={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Seed')).not.toBeInTheDocument();
    rerender(<ControlPanel schema={schema} config={{ seed: 0 }} setConfig={vi.fn()} showHidden />);
    expect(screen.getByLabelText('Seed')).toBeInTheDocument();
  });

  it('groups sectioned leaves under a heading, ungrouped ones first', () => {
    const schema = resolveConfigSchema(
      f.schema({ showGrid: f.boolean(true), seed: f.number(0).section('Advanced') }),
      [],
    );
    renderWithIcons(
      <ControlPanel schema={schema} config={{ showGrid: true, seed: 0 }} setConfig={vi.fn()} />,
    );
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    const group = screen.getByRole('heading', { name: 'Advanced' }).parentElement;
    expect(group).not.toBeNull();
    expect(group?.textContent).toContain('Seed');
    expect(group?.textContent).not.toContain('Show grid');
  });
});

describe('<ControlPanel> group descriptions', () => {
  it('heads a group named as its section once, with the group’s rows under the section', () => {
    const schema = resolveConfigSchema(
      f.schema({
        debug: f
          .group({ boxes: f.boolean(false) })
          .section('Debug')
          .label('Debug'),
        route: f.boolean(false).section('Debug'),
        other: f
          .group({ depth: f.number(1) })
          .section('Debug')
          .label('Other'),
      }),
      [],
    );
    renderWithIcons(
      <ControlPanel
        schema={schema}
        config={{ debug: { boxes: false }, route: false, other: { depth: 1 } }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('heading', { name: 'Debug' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByLabelText('Boxes')).toBeInTheDocument();
  });

  it('draws a named group’s describe() above its rows', () => {
    const schema = resolveConfigSchema(
      f.schema({
        grid: f
          .group({ cellSize: f.number(20) })
          .label('Grid')
          .describe('How the background lattice is spaced.'),
      }),
      [],
    );
    renderWithIcons(
      <ControlPanel schema={schema} config={{ grid: { cellSize: 20 } }} setConfig={vi.fn()} />,
    );
    const note = screen.getByText('How the background lattice is spaced.');
    const field = screen.getByLabelText('Cell size');
    expect(note.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('<ControlPanel> section layout', () => {
  const schema = resolveConfigSchema(
    f.schema({
      seed: f.number(0).section('Advanced'),
      mode: f
        .enum('a', [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ])
        .label('Mode')
        .section('Globals', { layout: 'block', pack: 'one-up', className: 'pins' }),
      font: f
        .enum('x', [{ value: 'x', label: 'X' }])
        .label('Font')
        .section('Globals'),
    }),
    [],
  );
  const config = { seed: 0, mode: 'a', font: 'x' };
  // The row class comes through the CSS-module proxy, so this proves which layout the row asked for, not a rule.
  const rowOf = (label: string) => screen.getByText(label).closest('label') as HTMLElement;

  it('lays out every row in a section the way the section asks, and leaves other sections alone', () => {
    renderWithIcons(<ControlPanel schema={schema} config={config} setConfig={vi.fn()} />);
    expect(rowOf('Mode').className).not.toMatch(/rowInline/);
    expect(rowOf('Font').className).not.toMatch(/rowInline/);
    expect(rowOf('Seed').className).toMatch(/rowInline/);
  });

  it('carries a section’s layout into its resolved spec', () => {
    expect(schema.sections.find((section) => section.label === 'Globals')).toMatchObject({
      layout: 'block',
      pack: 'one-up',
    });
    expect(schema.sections.find((section) => section.label === 'Advanced')).not.toHaveProperty(
      'layout',
    );
  });
  it('puts a section’s class on that section’s frame alone', () => {
    renderWithIcons(<ControlPanel schema={schema} config={config} setConfig={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Globals' }).className).toMatch(/(^| )pins( |$)/);
    expect(screen.getByRole('group', { name: 'Advanced' }).className).not.toMatch(/(^| )pins( |$)/);
  });
});

describe('<ControlPanel> collapsible sections', () => {
  const schema = resolveConfigSchema(
    f.schema({ showGrid: f.boolean(true), seed: f.number(0).section('Advanced') }),
    [],
  );
  const config = { showGrid: true, seed: 0 };

  it('draws no twisty by default', () => {
    renderWithIcons(<ControlPanel schema={schema} config={config} setConfig={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Advanced' })).toBeNull();
    expect(screen.getByLabelText('Seed')).toBeVisible();
  });

  it('folds a section away when the panel starts closed', () => {
    renderWithIcons(
      <ControlPanel schema={schema} config={config} setConfig={vi.fn()} collapse="closed" />,
    );
    expect(screen.getByLabelText('Seed')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByLabelText('Seed')).toBeVisible();
  });

  it('hands a controlled panel its toggles instead of acting on them', () => {
    const onCollapse = vi.fn();
    renderWithIcons(
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={vi.fn()}
        collapsed={{ Advanced: true }}
        onCollapse={onCollapse}
      />,
    );
    expect(screen.getByLabelText('Seed')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onCollapse).toHaveBeenCalledWith('Advanced', false);
    expect(screen.getByLabelText('Seed')).not.toBeVisible();
  });

  describe('a section the schema declares closed', () => {
    const closedSchema = resolveConfigSchema(
      f.schema({
        showGrid: f.boolean(true),
        seed: f.number(0).section('Advanced', { collapsed: true }),
      }),
      [],
    );

    it('opens folded, and is foldable, with no collapse props at all', () => {
      renderWithIcons(<ControlPanel schema={closedSchema} config={config} setConfig={vi.fn()} />);
      expect(screen.getByLabelText('Seed')).not.toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
      expect(screen.getByLabelText('Seed')).toBeVisible();
    });

    it('yields to a remembered fold, so a toggle the reader made survives', () => {
      renderWithIcons(
        <ControlPanel
          schema={closedSchema}
          config={config}
          setConfig={vi.fn()}
          collapsed={{ Advanced: false }}
          onCollapse={vi.fn()}
        />,
      );
      expect(screen.getByLabelText('Seed')).toBeVisible();
    });
  });
});

describe('<ControlPanel> title, stance and tone', () => {
  const fields: ConfigField[] = [{ key: 'on', label: 'On', type: 'checkbox', default: true }];

  it('renders the bare list when given none of them', () => {
    const { container } = renderWithIcons(
      <ControlPanel fields={fields} config={{ on: true }} setConfig={vi.fn()} />,
    );
    expect(container.firstElementChild?.classList.contains('lk-control-panel')).toBe(true);
    expect(container.querySelector('[data-stance], h2')).toBeNull();
  });

  it('wraps its rows in a panel carrying them when asked', () => {
    const { container } = renderWithIcons(
      <ControlPanel
        title="View"
        stance="scope"
        tone={1}
        fields={fields}
        config={{ on: true }}
        setConfig={vi.fn()}
      />,
    );
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.dataset.stance).toBe('scope');
    expect(panel.dataset.tone).toBe('1');
    expect(screen.getByRole('heading', { name: 'View' })).toBeTruthy();
    expect(panel.querySelector('.lk-control-panel')).not.toBeNull();
  });
});

describe('<ControlPanel> resettable group', () => {
  const schema = resolveConfigSchema(
    f.schema({
      name: f.string('a'),
      modes: f
        .group({ one: f.number(0), two: f.number(0), inner: f.group({ three: f.number(1) }) })
        .resettable(),
      plain: f.group({ four: f.number(0) }),
    }),
  );

  it('puts a reset button on the group heading, disabled while nothing has changed', () => {
    renderWithIcons(
      <ControlPanel
        schema={schema}
        config={{ name: 'a', modes: { one: 0, two: 0, inner: { three: 1 } }, plain: { four: 0 } }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reset Modes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reset Plain' })).toBeNull();
  });

  it('writes the group whole, once, with every value beneath it at its default', () => {
    const setConfig = vi.fn();
    renderWithIcons(
      <ControlPanel
        schema={schema}
        config={{
          name: 'b',
          modes: { one: 2, two: 0, inner: { three: 5 }, kept: 'x' },
          plain: { four: 3 },
        }}
        setConfig={setConfig}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Modes' }));
    expect(setConfig.mock.calls).toEqual([
      ['modes', { one: 0, two: 0, inner: { three: 1 }, kept: 'x' }],
    ]);
  });
});

describe('<ControlPanel> groups drawn `as`', () => {
  const schema = resolveConfigSchema(
    f.schema({
      light: f.group({ glow: f.boolean(true) }).as('tab'),
      dark: f.group({ dim: f.boolean(false) }).as('tab'),
      notes: f.group({ shout: f.boolean(false) }).as('section'),
    }),
    [],
  );

  it('sets neighboring tab groups under one strip and shows the rows of the one picked', async () => {
    renderWithIcons(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Light', 'Dark']);
    expect(screen.getByLabelText('Glow')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dim')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByLabelText('Dim')).toBeInTheDocument();
    expect(screen.queryByLabelText('Glow')).toBeNull();
  });

  it('heads a section group with its name, in the frameless divider motif', () => {
    renderWithIcons(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Notes' })).toHaveAttribute('data-motif', 'divider');
    expect(screen.getByLabelText('Shout')).toBeInTheDocument();
  });
});
