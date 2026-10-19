import { Profiler } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { RegistryTree } from './RegistryTree';
import type { TreeCategoryNode } from './registryEntries';
import { renderWithIcons } from '../testIcons';

const NODES: readonly TreeCategoryNode[] = [
  {
    id: 'ops',
    label: 'Ops',
    entries: [
      { kind: 'opFactory', id: 'rect', label: 'useRectTool' },
      { kind: 'opFactory', id: 'ellipse', label: 'useEllipseTool' },
    ],
  },
  {
    id: 'icons',
    label: 'Icons',
    entries: [{ kind: 'opKind', id: 'delete', label: 'Delete' }],
  },
];

const item = (name: string | RegExp) => screen.getByRole('treeitem', { name });
const queryItem = (name: string | RegExp) => screen.queryByRole('treeitem', { name });

describe('RegistryTree', () => {
  it('renders the categories as collapsed branches of a tree, with their counts', () => {
    renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('tree', { name: 'Registry' })).toBeTruthy();
    expect(item('Ops 2')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Icons 1')).toHaveAttribute('aria-level', '1');
  });

  it('expands a category on click and shows its entries', () => {
    renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Ops'));
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    const group = within(item(/^Ops/)).getByRole('group');
    expect(within(group).getByRole('treeitem', { name: 'useRectTool' })).toHaveAttribute('aria-level', '2');
    expect(within(group).getByRole('treeitem', { name: 'useEllipseTool' })).toBeTruthy();
  });

  it('expands a category from the keyboard', () => {
    renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    const ops = item(/^Ops/);
    act(() => ops.focus());
    fireEvent.keyDown(ops, { key: 'ArrowRight' });
    expect(ops).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
  });

  it('text filter narrows leaves and auto-expands parents', () => {
    renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'rect' } });
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
    expect(queryItem('useEllipseTool')).toBeNull();
    expect(queryItem(/^Icons/)).toBeNull();
  });

  it('keeps categories open while filtering, and restores the unfiltered state after', () => {
    renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'e' } });
    fireEvent.click(screen.getByText('Ops'));
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: '' } });
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onSelect when a leaf is clicked, and marks the selected leaf', () => {
    const onSelect = vi.fn();
    const { rerender } = renderWithIcons(<RegistryTree nodes={NODES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Ops'));
    fireEvent.click(screen.getByText('useRectTool'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: 'opFactory', id: 'rect' });
    rerender(<RegistryTree nodes={NODES} selected={onSelect.mock.calls[0][0]} onSelect={onSelect} />);
    expect(item('useRectTool')).toHaveAttribute('aria-selected', 'true');
    expect(item('useEllipseTool')).toHaveAttribute('aria-selected', 'false');
  });

  it('never commits the selected entry’s category closed', () => {
    const expanded: (string | null)[] = [];
    renderWithIcons(
      <Profiler
        id="tree"
        onRender={() => { expanded.push(queryItem(/^Icons/)?.getAttribute('aria-expanded') ?? null); }}
      >
        <RegistryTree nodes={NODES} selected={NODES[1].entries[0]} onSelect={() => {}} />
      </Profiler>,
    );
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((v) => v === 'true')).toBe(true);
  });

  it('leaves a collapsed category shut until the selection moves into it again', () => {
    const { rerender } = renderWithIcons(<RegistryTree nodes={NODES} selected={NODES[1].entries[0]} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Icons'));
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'false');
    rerender(<RegistryTree nodes={NODES} selected={NODES[1].entries[0]} onSelect={() => {}} />);
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'false');
    rerender(<RegistryTree nodes={NODES} selected={NODES[0].entries[0]} onSelect={() => {}} />);
    rerender(<RegistryTree nodes={NODES} selected={NODES[1].entries[0]} onSelect={() => {}} />);
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a per-leaf count from getCount', () => {
    renderWithIcons(
      <RegistryTree
        nodes={NODES}
        selected={null}
        onSelect={() => {}}
        getCount={(e) => (e.id === 'rect' ? 9 : undefined)}
      />,
    );
    fireEvent.click(screen.getByText('Ops'));
    expect(item('useRectTool 9')).toBeTruthy();
    expect(item('useEllipseTool')).toBeTruthy();
  });
});

describe('RegistryTree — collapsible group', () => {
  const groupedNodes: readonly TreeCategoryNode[] = [
    {
      id: 'shape',
      label: 'Shape',
      group: { id: 'traits', label: 'Traits' },
      entries: [{ kind: 'shapeKind', trait: 'shape', id: 'rect', label: 'rect' }],
    },
    {
      id: 'properties',
      label: 'Properties',
      group: { id: 'traits', label: 'Traits' },
      entries: [{ kind: 'propertiesKind', trait: 'properties', id: 'rect', label: 'rect', leafPaths: [] }],
    },
  ];

  it('renders the group as a collapsed branch; children hidden by default', () => {
    renderWithIcons(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    expect(item('Traits 2')).toHaveAttribute('aria-expanded', 'false');
    expect(queryItem(/^Shape/)).toBeNull();
    expect(queryItem(/^Properties/)).toBeNull();
  });

  it('expands the group on click and reveals its child categories', () => {
    renderWithIcons(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Traits'));
    expect(item(/^Shape/)).toHaveAttribute('aria-level', '2');
    expect(item(/^Properties/)).toHaveAttribute('aria-expanded', 'false');
    // The child categories are themselves collapsible — their entries
    // remain hidden until the child is also expanded.
    expect(screen.queryAllByRole('treeitem', { name: 'rect' }).length).toBe(0);
  });

  it('auto-expands the group and the child category when a leaf is selected inside it', () => {
    renderWithIcons(
      <RegistryTree
        nodes={groupedNodes}
        selected={{ kind: 'propertiesKind', trait: 'properties', id: 'rect', label: 'rect', leafPaths: [] }}
        onSelect={() => {}}
      />,
    );
    expect(item(/^Traits/)).toHaveAttribute('aria-expanded', 'true');
    expect(item(/^Properties/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('rect')).toHaveAttribute('aria-level', '3');
    expect(item('rect')).toHaveAttribute('aria-selected', 'true');
  });
});
