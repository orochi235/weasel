import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LayerDescriptor } from '../instrument/types';
import { LayerList } from './LayerList';

describe('<LayerList>', () => {
  it('renders one row per layer', () => {
    const layers: LayerDescriptor[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const { container } = render(
      <LayerList
        layers={layers}
        visibility={{ a: true, b: true }}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.lk-layer-list__row')).toHaveLength(2);
  });

  it('renders empty state when no layers', () => {
    render(<LayerList layers={[]} visibility={{}} onReorder={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByText('No layers')).toBeInTheDocument();
  });

  it('alwaysOn rows have no checkbox and show lock icon', () => {
    const layers: LayerDescriptor[] = [{ id: 'a', label: 'A', alwaysOn: true }];
    render(<LayerList layers={layers} visibility={{}} onReorder={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.queryByLabelText('Toggle A')).toBeNull();
    expect(screen.getByLabelText('Always on')).toBeInTheDocument();
  });

  it('onToggle fires on checkbox click', () => {
    const onToggle = vi.fn();
    const layers: LayerDescriptor[] = [{ id: 'a', label: 'A' }];
    render(
      <LayerList
        layers={layers}
        visibility={{ a: true }}
        onReorder={vi.fn()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText('Toggle A'));
    expect(onToggle).toHaveBeenCalledWith('a', false);
  });
});
