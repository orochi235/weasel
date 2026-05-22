import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistryTree } from './RegistryTree';
import type { PhaseSummary, TreeCategoryNode } from './registryData';

const EMPTY_PHASE: PhaseSummary = {
  gestures: {
    click: false, pointerDown: false, dblTap: false, drag: false,
    wheel: false, keyDown: false, keyUp: false,
  },
  outputs: { cursor: false, overlay: false, claimsAll: false },
};
const EMPTY_CAPS = {
  initScratch: false, onActivate: false, onDeactivate: false, hitOverride: false,
};

const NODES: readonly TreeCategoryNode[] = [
  {
    id: 'tools',
    label: 'Tools',
    entries: [
      { kind: 'tool', id: 'rect', label: 'useRectTool', routes: [], slot: 'registry',
        phases: { initial: EMPTY_PHASE }, capabilities: EMPTY_CAPS },
      { kind: 'tool', id: 'ellipse', label: 'useEllipseTool', routes: [], slot: 'registry',
        phases: { initial: EMPTY_PHASE }, capabilities: EMPTY_CAPS },
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
      id: 'shapeKinds',
      label: 'Shape kinds',
      group: { id: 'facets', label: 'Facets' },
      entries: [{ kind: 'shapeKind', facet: 'shape', id: 'rect', label: 'rect' }],
    },
    {
      id: 'routingKinds',
      label: 'Routing kinds',
      group: { id: 'facets', label: 'Facets' },
      entries: [{ kind: 'routingKind', facet: 'routing', id: 'rect', label: 'rect', source: 'default', shapeKindId: 'rect' }],
    },
  ];

  it('renders the group as a collapsible row; children hidden by default', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('Facets')).toBeTruthy();
    expect(screen.queryByText('Shape kinds')).toBeNull();
    expect(screen.queryByText('Routing kinds')).toBeNull();
  });

  it('expands the group on click and reveals its child categories', () => {
    render(<RegistryTree nodes={groupedNodes} selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Facets'));
    expect(screen.getByText('Shape kinds')).toBeTruthy();
    expect(screen.getByText('Routing kinds')).toBeTruthy();
    // The child categories are themselves collapsible — their entries
    // remain hidden until the child is also expanded.
    expect(screen.queryAllByText('rect').length).toBe(0);
  });

  it('auto-expands the group and the child category when a leaf is selected inside it', () => {
    render(
      <RegistryTree
        nodes={groupedNodes}
        selected={{ kind: 'routingKind', facet: 'routing', id: 'rect', label: 'rect', source: 'default', shapeKindId: 'rect' }}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Routing kinds')).toBeTruthy();
    // The leaf itself renders since its containing category is open.
    expect(screen.getAllByText('rect').length).toBeGreaterThan(0);
  });
});
