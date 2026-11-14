import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  type NodePropertiesEntry,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import {
  routing,
  properties,
  makeScene,
  selectionOf,
} from './testing/rectScene';

describe('SelectionPanel', () => {
  it('renders empty state with no selection', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf([])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('shows kind header, sections, and values for a single node', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveValue('10');
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
  });

  it('multi-select shows count header and Mixed placeholders', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('rect ×2')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveAttribute('placeholder', 'Mixed');
    expect(screen.getByLabelText('Position Y')).toHaveValue('20'); // shared value renders
  });

  it('custom renderer overrides a built-in kind', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        renderers={{ color: (ctx) => <button type="button">custom:{ctx.path}</button> }}
      />,
    );
    expect(screen.getByText('custom:data.fill')).toBeInTheDocument();
  });

  it('kindLabel overrides the header derivation', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        kindLabel={(k) => `<${k}>`}
      />,
    );
    expect(screen.getByText('<rect>')).toBeInTheDocument();
  });

  it('ignores dead selection ids and renders from live nodes', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'zombie'])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveValue('10');
    expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
  });

  it('renders emptyState when every selected id is dead', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['zombie', 'ghost'])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('unknown custom leaf kind with no renderer shows a placeholder', () => {
    const withCustom: NodePropertiesEntry[] = [
      {
        name: 'rect',
        schema: {
          name: 'Properties',
          members: {
            'data.special': { kind: 'sparkle', name: 'Special', description: 's', default: null },
          },
        },
      },
    ];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={withCustom}
        routing={routing}
      />,
    );
    expect(screen.getByText('(sparkle: no renderer)')).toBeInTheDocument();
  });

  it('null-returning renderer collapses chrome: lone rows drop their section title, pair rows survive', () => {
    // Appearance holds a single-leaf row (Fill) — nulling it must remove
    // the row AND the now-empty section title. Layout's Position pair
    // loses only X; the row survives with Y.
    const props: NodePropertiesEntry[] = [
      {
        name: 'rect',
        schema: {
          name: 'Properties',
          members: {
            layout: {
              name: 'Layout',
              members: {
                'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, pair: { with: 'pose.y', label: 'Position' } },
                'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0 },
              },
            },
            appearance: {
              name: 'Appearance',
              members: {
                'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000000ff', alpha: true },
              },
            },
          },
        },
      },
    ];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={props}
        routing={routing}
        renderers={{ 'data.fill': () => null, 'pose.x': () => null }}
      />,
    );
    // Single-leaf row: row label and section title both gone.
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
    // Pair row: X collapsed, row remains with Y.
    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByLabelText('Position Y')).toHaveValue('20');
  });
});
