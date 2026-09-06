import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayerStack, type LayerStackItem, type LayerStackProps } from './LayerStack';

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
    expect(screen.getAllByTestId(/layer-card-/)).toHaveLength(3);
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


  it('appends className to the root, keeping its own hashed class', () => {
    const { container } = render(
      <LayerStack
        title="Fill"
        items={items}
        paletteKinds={['fill']}
        onAdd={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onPrimaryChange={() => {}}
        renderBody={() => null}
        className="host-stack"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('host-stack')).toBe(true);
    expect(root.classList.length).toBeGreaterThan(1);
  });
});

describe('LayerStack without a palette or kinds', () => {
  const kindless: LayerStackItem[] = [
    { id: 'top', label: 'Base coat' },
    { id: 'mid', label: 'Wash' },
  ];

  function renderKindless(extra: Partial<LayerStackProps> = {}) {
    return render(
      <LayerStack
        items={kindless}
        onReorder={() => {}}
        renderBody={(item) => <div data-testid={`body-${item.id}`} />}
        {...extra}
      />,
    );
  }

  it('renders no head when there is neither a title nor a palette', () => {
    const { container } = renderKindless();
    expect(container.querySelector('h2')).toBeNull();
    expect(screen.queryByRole('button', { name: /^add /i })).toBeNull();
  });

  it('names each card from its label', () => {
    renderKindless();
    expect(screen.getByText('Base coat')).toBeInTheDocument();
    expect(screen.getByText('Wash')).toBeInTheDocument();
  });

  it('omits the remove button when onRemove is not given', () => {
    renderKindless();
    expect(screen.queryByRole('button', { name: /remove layer/i })).toBeNull();
  });

  it('keeps the remove button when onRemove is given', () => {
    const onRemove = vi.fn();
    renderKindless({ onRemove });
    fireEvent.click(screen.getAllByRole('button', { name: /remove layer/i })[1]);
    expect(onRemove).toHaveBeenCalledWith('mid');
  });

  it('does not point at a palette that is not there when empty', () => {
    render(<LayerStack items={[]} onReorder={() => {}} renderBody={() => null} />);
    expect(screen.getByText('No layers.')).toBeInTheDocument();
  });

  it('points at the palette when one exists', () => {
    render(
      <LayerStack
        items={[]}
        paletteKinds={['fill']}
        onAdd={() => {}}
        onReorder={() => {}}
        renderBody={() => null}
      />,
    );
    expect(screen.getByText('No layers — add one above.')).toBeInTheDocument();
  });

  it('takes an emptyLabel over either default', () => {
    render(
      <LayerStack items={[]} onReorder={() => {}} renderBody={() => null} emptyLabel="Nothing yet" />,
    );
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('hides the palette when paletteKinds is given without a handler', () => {
    renderKindless({ paletteKinds: ['fill'] });
    expect(screen.queryByRole('button', { name: /add fill/i })).toBeNull();
  });

  it('shows the kind as text rather than a select when onPrimaryChange is absent', () => {
    render(
      <LayerStack
        items={[{ id: 1, kind: 'fill', primaryValue: 'aqua', primaryOptions: ['aqua', 'dome'] }]}
        onReorder={() => {}}
        renderBody={() => null}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('fill')).toBeInTheDocument();
  });
});
