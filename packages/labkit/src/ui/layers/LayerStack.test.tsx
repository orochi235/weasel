import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// useReorderDragList pulls its own React copy from weasel/node_modules, which
// breaks hooks in jsdom. Stub it out with a no-op implementation.
vi.mock('../../passthrough/weasel-ui', () => ({
  useReorderDragList: () => ({
    rowProps: (_id: string, _i: number) => ({ onPointerDown: () => {} }),
    containerProps: {
      ref: () => {},
      onPointerMove: () => {},
      onPointerUp: () => {},
      onPointerCancel: () => {},
    },
    state: { draggedIds: null, targetIndex: null },
  }),
}));

import { LayerStack, type LayerStackItem } from './LayerStack';

const items: LayerStackItem[] = [
  { id: 1, kind: 'fill', primaryValue: 'aqua', primaryOptions: ['aqua', 'bevel', 'dome'] },
  { id: 2, kind: 'tail', accent: '#f44', badge: '1' },
  { id: 3, kind: 'shadow' },
];

describe('LayerStack', () => {
  it('renders header + add buttons + each item', () => {
    render(
      <LayerStack
        title="Fill"
        items={items}
        paletteKinds={['fill', 'tail', 'shadow']}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={(item) => <div>body-{item.id}</div>}
      />,
    );
    expect(screen.getByText('Fill')).toBeInTheDocument();
    for (const k of ['fill', 'tail', 'shadow']) {
      expect(screen.getByRole('button', { name: new RegExp(`add ${k}`, 'i') })).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/lk-layer-card-/)).toHaveLength(3);
  });

  it('clicking a palette button calls onAdd with that kind', () => {
    const onAdd = vi.fn();
    render(
      <LayerStack
        title="Fill"
        items={items}
        paletteKinds={['fill', 'tail']}
        onAdd={onAdd}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={() => null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add tail/i }));
    expect(onAdd).toHaveBeenCalledWith('tail');
  });

  it('clicking the remove button calls onRemove with that id', () => {
    const onRemove = vi.fn();
    render(
      <LayerStack
        title="Fill"
        items={items}
        paletteKinds={[]}
        onAdd={() => {}}
        onRemove={onRemove}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={() => null}
      />,
    );
    const removes = screen.getAllByRole('button', { name: /remove layer/i });
    fireEvent.click(removes[1]);
    expect(onRemove).toHaveBeenCalledWith(2);
  });

  it('shows empty state when items is empty', () => {
    render(
      <LayerStack
        title="Empty"
        items={[]}
        paletteKinds={['fill']}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={() => null}
      />,
    );
    expect(screen.getByText(/no layers/i)).toBeInTheDocument();
  });

  it('changing the primary select calls onPrimaryChange', () => {
    const onPrimaryChange = vi.fn();
    render(
      <LayerStack
        title="Fill"
        items={items}
        paletteKinds={[]}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={onPrimaryChange}
        renderBody={() => null}
      />,
    );
    const sel = screen.getByLabelText(/primary select for layer 1/i) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'bevel' } });
    expect(onPrimaryChange).toHaveBeenCalledWith(1, 'bevel');
  });

  it('newly added items render expanded by default', () => {
    const initial: LayerStackItem[] = [{ id: 1, kind: 'fill' }];
    const { rerender } = render(
      <LayerStack
        title="Fill"
        items={initial}
        paletteKinds={[]}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={(item) => <div data-testid={`body-${item.id}`}>b{item.id}</div>}
      />,
    );
    expect(screen.getByTestId('body-1')).toBeInTheDocument();
    rerender(
      <LayerStack
        title="Fill"
        items={[...initial, { id: 2, kind: 'tail' }]}
        paletteKinds={[]}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={(item) => <div data-testid={`body-${item.id}`}>b{item.id}</div>}
      />,
    );
    expect(screen.getByTestId('body-2')).toBeInTheDocument();
  });

  it('items with defaultExpanded: false render collapsed', () => {
    render(
      <LayerStack
        title="Fill"
        items={[{ id: 1, kind: 'fill', defaultExpanded: false }]}
        paletteKinds={[]}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={(item) => <div data-testid={`body-${item.id}`}>b{item.id}</div>}
      />,
    );
    expect(screen.queryByTestId('body-1')).not.toBeInTheDocument();
  });

  // TODO: reorder off-by-one fix (Bug 1) is covered by manual integration
  // testing in speech-balloons once LayerStack is consumed there (B3).
  // useReorderDragList is mocked in unit tests, making onReorder untestable here.
});
