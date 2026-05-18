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
