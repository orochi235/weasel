import { act, fireEvent, render, screen } from '@testing-library/react';
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

const twoLayers: LayerDescriptor[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];

function dispatchOn(target: EventTarget, type: string, init: PointerEventInit) {
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, ...init }));
  });
}

/** jsdom measures every row at zero height, so `startDrag` falls back to a
 *  pitch of 1: one pixel of travel is one row. */
function renderDraggable(onReorder = vi.fn()) {
  const result = render(
    <LayerList
      layers={twoLayers}
      visibility={{ a: true, b: true }}
      onReorder={onReorder}
      onToggle={vi.fn()}
    />,
  );
  return { ...result, onReorder, handle: screen.getByLabelText('Reorder A') };
}

describe('<LayerList> reordering', () => {
  it('reorders from a release that lands off the handle', () => {
    const { onReorder, handle } = renderDraggable();
    fireEvent.pointerDown(handle, { pointerId: 1, buttons: 1, clientY: 0 });
    dispatchOn(document, 'pointermove', { buttons: 1, clientY: 1 });
    dispatchOn(document, 'pointerup', { clientY: 1 });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.calls[0][0].map((l: LayerDescriptor) => l.id)).toEqual(['b', 'a']);
  });

  it('abandons the reorder when capture is lost mid-drag', () => {
    const { onReorder, handle, container } = renderDraggable();
    fireEvent.pointerDown(handle, { pointerId: 1, buttons: 1, clientY: 0 });
    dispatchOn(document, 'pointermove', { buttons: 1, clientY: 1 });
    dispatchOn(handle, 'lostpointercapture', {});
    expect(onReorder).not.toHaveBeenCalled();
    expect(container.querySelector('.lk-layer-list__row--dragging')).toBeNull();
  });

  it('reads a move with nothing held as the release that never arrived', () => {
    const { onReorder, handle } = renderDraggable();
    fireEvent.pointerDown(handle, { pointerId: 1, buttons: 1, clientY: 0 });
    dispatchOn(document, 'pointermove', { buttons: 1, clientY: 1 });
    dispatchOn(document, 'pointermove', { buttons: 0, clientY: 40 });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.calls[0][0].map((l: LayerDescriptor) => l.id)).toEqual(['b', 'a']);
  });

  it('drops its listeners when the list unmounts mid-drag', () => {
    const { onReorder, handle, unmount } = renderDraggable();
    fireEvent.pointerDown(handle, { pointerId: 1, buttons: 1, clientY: 0 });
    dispatchOn(document, 'pointermove', { buttons: 1, clientY: 1 });
    unmount();
    dispatchOn(document, 'pointerup', { clientY: 1 });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not capture a second pointer into the same drag', () => {
    const { onReorder, handle } = renderDraggable();
    fireEvent.pointerDown(handle, { pointerId: 1, buttons: 1, clientY: 0 });
    dispatchOn(document, 'pointermove', { pointerId: 2, buttons: 1, clientY: 40 });
    dispatchOn(document, 'pointerup', { pointerId: 1, clientY: 0 });
    expect(onReorder).not.toHaveBeenCalled();
  });
});
