import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistryTree } from './RegistryTree';
import type { TreeCategoryNode } from './registryData';

const NODES: readonly TreeCategoryNode[] = [
  {
    id: 'tools',
    label: 'Tools',
    entries: [
      { kind: 'tool', id: 'rect', label: 'useRectTool', routes: [] },
      { kind: 'tool', id: 'ellipse', label: 'useEllipseTool', routes: [] },
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
    expect(screen.getByText('rect')).toBeTruthy();
    expect(screen.getByText('ellipse')).toBeTruthy();
  });

  it('text filter narrows leaves and auto-expands parents', () => {
    render(<RegistryTree nodes={NODES} selected={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'rect' } });
    expect(screen.getByText('rect')).toBeTruthy();
    expect(screen.queryByText('ellipse')).toBeNull();
    expect(screen.queryByText('delete')).toBeNull();
  });

  it('calls onSelect when a leaf is clicked', () => {
    const onSelect = vi.fn();
    render(<RegistryTree nodes={NODES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Tools'));
    fireEvent.click(screen.getByText('rect'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: 'tool', id: 'rect' });
  });
});
