import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RegistryTree } from './RegistryTree';
import type { ToolSurface, TreeCategoryNode } from './registryData';

const EMPTY_SURFACE: ToolSurface = {
  gestures: {
    click: false, doubleClick: false, pointerDown: false, drag: false,
    wheel: false, key: false, keyHeld: false, contextMenu: false,
    multiTouchTap: false,
  },
  outputs: { cursor: false, overlay: false },
};
const EMPTY_CAPS = {
  initScratch: false, onActivate: false, onDeactivate: false,
};

const NODES: readonly TreeCategoryNode[] = [
  {
    id: 'tools',
    label: 'Tools',
    entries: [
      { kind: 'tool', id: 'rect', label: 'useRectTool', routes: [], declaredRoutes: [], slot: 'registry', capabilities: EMPTY_CAPS, surface: EMPTY_SURFACE },
      { kind: 'tool', id: 'ellipse', label: 'useEllipseTool', routes: [], declaredRoutes: [], slot: 'registry', capabilities: EMPTY_CAPS, surface: EMPTY_SURFACE },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    entries: [{ kind: 'action', id: 'delete', label: 'Delete' }],
  },
];

const item = (name: string | RegExp) => screen.getByRole('treeitem', { name });
const queryItem = (name: string | RegExp) => screen.queryByRole('treeitem', { name });

describe('RegistryTree', () => {
  it('renders the categories as collapsed branches of a tree, with their counts', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('tree', { name: 'Registry' })).toBeTruthy();
    expect(item('Tools 2')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Actions 1')).toHaveAttribute('aria-level', '1');
  });

  it('expands a category on click and shows its entries', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Tools'));
    expect(item(/^Tools/)).toHaveAttribute('aria-expanded', 'true');
    const group = within(item(/^Tools/)).getByRole('group');
    expect(within(group).getByRole('treeitem', { name: 'useRectTool' })).toHaveAttribute('aria-level', '2');
    expect(within(group).getByRole('treeitem', { name: 'useEllipseTool' })).toBeTruthy();
  });

  it('expands a category from the keyboard', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    const tools = item(/^Tools/);
    tools.focus();
    fireEvent.keyDown(tools, { key: 'ArrowRight' });
    expect(tools).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
  });

  it('text filter narrows leaves and auto-expands parents', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'rect' } });
    expect(item(/^Tools/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
    expect(queryItem('useEllipseTool')).toBeNull();
    expect(queryItem(/^Actions/)).toBeNull();
  });

  it('keeps categories open while filtering, and restores the unfiltered state after', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'e' } });
    fireEvent.click(screen.getByText('Tools'));
    expect(item(/^Tools/)).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: '' } });
    expect(item(/^Tools/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onSelect when a leaf is clicked, and marks the selected leaf', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<RegistryTree nodes={NODES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Tools'));
    fireEvent.click(screen.getByText('useRectTool'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: 'tool', id: 'rect' });
    rerender(<RegistryTree nodes={NODES} selected={onSelect.mock.calls[0][0]} onSelect={onSelect} />);
    expect(item('useRectTool')).toHaveAttribute('aria-selected', 'true');
    expect(item('useEllipseTool')).toHaveAttribute('aria-selected', 'false');
  });

  it('shows a per-leaf count from getCount', () => {
    render(
      <RegistryTree
        nodes={NODES}
        selected={null}
        onSelect={() => {}}
        getCount={(e) => (e.id === 'rect' ? 9 : undefined)}
      />,
    );
    fireEvent.click(screen.getByText('Tools'));
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
      id: 'routing',
      label: 'Routing',
      group: { id: 'traits', label: 'Traits' },
      entries: [{ kind: 'routingKind', trait: 'routing', id: 'rect', label: 'rect', source: 'default', shapeKindId: 'rect' }],
    },
  ];

  it('renders the group as a collapsed branch; children hidden by default', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    expect(item('Traits 2')).toHaveAttribute('aria-expanded', 'false');
    expect(queryItem(/^Shape/)).toBeNull();
    expect(queryItem(/^Routing/)).toBeNull();
  });

  it('expands the group on click and reveals its child categories', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Traits'));
    expect(item(/^Shape/)).toHaveAttribute('aria-level', '2');
    expect(item(/^Routing/)).toHaveAttribute('aria-expanded', 'false');
    // The child categories are themselves collapsible — their entries
    // remain hidden until the child is also expanded.
    expect(screen.queryAllByRole('treeitem', { name: 'rect' }).length).toBe(0);
  });

  it('auto-expands the group and the child category when a leaf is selected inside it', () => {
    render(
      <RegistryTree
        nodes={groupedNodes}
        selected={{ kind: 'routingKind', trait: 'routing', id: 'rect', label: 'rect', source: 'default', shapeKindId: 'rect' }}
        onSelect={() => {}}
      />,
    );
    expect(item(/^Traits/)).toHaveAttribute('aria-expanded', 'true');
    expect(item(/^Routing/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('rect')).toHaveAttribute('aria-level', '3');
    expect(item('rect')).toHaveAttribute('aria-selected', 'true');
  });
});
