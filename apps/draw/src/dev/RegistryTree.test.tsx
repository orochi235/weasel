import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
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

describe('RegistryTree', () => {
  it('renders category headings', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('Tools')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('expands a category on click and shows its entries', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('useRectTool')).toBeTruthy();
    expect(screen.getByText('useEllipseTool')).toBeTruthy();
  });

  it('text filter narrows leaves and auto-expands parents', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'rect' } });
    expect(screen.getByText('useRectTool')).toBeTruthy();
    expect(screen.queryByText('useEllipseTool')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('calls onSelect when a leaf is clicked', () => {
    const onSelect = vi.fn();
    render(<RegistryTree nodes={NODES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Tools'));
    fireEvent.click(screen.getByText('useRectTool'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: 'tool', id: 'rect' });
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

  it('renders the group as a collapsible row; children hidden by default', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('Traits')).toBeTruthy();
    expect(screen.queryByText('Shape')).toBeNull();
    expect(screen.queryByText('Routing')).toBeNull();
  });

  it('expands the group on click and reveals its child categories', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Traits'));
    expect(screen.getByText('Shape')).toBeTruthy();
    expect(screen.getByText('Routing')).toBeTruthy();
    // The child categories are themselves collapsible — their entries
    // remain hidden until the child is also expanded.
    expect(screen.queryAllByText('rect').length).toBe(0);
  });

  it('auto-expands the group and the child category when a leaf is selected inside it', () => {
    render(
      <RegistryTree
        nodes={groupedNodes}
        selected={{ kind: 'routingKind', trait: 'routing', id: 'rect', label: 'rect', source: 'default', shapeKindId: 'rect' }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Routing')).toBeTruthy();
    // The leaf itself renders since its containing category is open.
    expect(screen.getAllByText('rect').length).toBeGreaterThan(0);
  });
});
