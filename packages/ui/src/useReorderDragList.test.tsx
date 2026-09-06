import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { RefCallback } from 'react';
import { useReorderDragList, type LayerListItem, type PressModifiers, type ReorderDragState } from './useReorderDragList';

const ITEMS: LayerListItem[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

const ROW_H = 32;

let latest: ReorderDragState = { draggedIds: null, targetIndex: null };

function Harness(props: {
  items: LayerListItem[];
  selectedIds: string[];
  onReorder: (ids: string[], targetIndex: number) => void;
  onPress?: (id: string, mods: PressModifiers) => void;
}) {
  const drag = useReorderDragList(props);
  latest = drag.state;
  return (
    <div data-testid="list" ref={drag.containerProps.ref as RefCallback<HTMLDivElement>}>
      {props.items.map((it, i) => (
        <div key={it.id} data-testid={`row-${it.id}`} {...drag.rowProps(it.id, i)} />
      ))}
    </div>
  );
}

/** Rows are zero-height in jsdom; stamp the 32px-per-row geometry the tests assume. */
function stubGeometry(container: HTMLElement) {
  const rows = Array.from(container.children) as HTMLElement[];
  rows.forEach((row, i) => {
    if (Object.getOwnPropertyDescriptor(row, 'getBoundingClientRect')) return;
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0, y: i * ROW_H, top: i * ROW_H, left: 0,
        right: 200, bottom: (i + 1) * ROW_H, width: 200, height: ROW_H,
      } as DOMRect),
    });
  });
}

function setup(items: LayerListItem[] = ITEMS, selectedIds: string[] = []) {
  const onReorder = vi.fn();
  const onPress = vi.fn();
  const view = render(
    <Harness items={items} selectedIds={selectedIds} onReorder={onReorder} onPress={onPress} />,
  );
  const list = view.getByTestId('list');
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
  stubGeometry(list);
  const row = (id: string) => view.getByTestId(`row-${id}`);
  const rerender = (next: LayerListItem[], sel: string[] = selectedIds) => {
    view.rerender(
      <Harness items={next} selectedIds={sel} onReorder={onReorder} onPress={onPress} />,
    );
    stubGeometry(list);
  };
  return { onReorder, onPress, list, row, rerender, unmount: view.unmount };
}

const press = (el: HTMLElement, y: number, extra: object = {}) =>
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: y, ...extra });
const move = (y: number, extra: object = {}) =>
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: y, ...extra });
const release = (y: number) =>
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: y });

describe('useReorderDragList', () => {
  it('plain pointerdown + pointerup (no move) does not fire onReorder', () => {
    const { onReorder, row } = setup(ITEMS, ['a']);
    press(row('b'), 48);
    release(48);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('drag past threshold + drop fires onReorder with [draggedId] when row is unselected', () => {
    const { onReorder, row } = setup(ITEMS, ['a']);
    press(row('c'), 80);
    move(20);
    release(20);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['c'], 0);
  });

  it('dragging a selected row moves entire selection as one block', () => {
    const { onReorder, row } = setup(ITEMS, ['a', 'c']);
    press(row('a'), 16);
    move(200);
    release(200);
    expect(onReorder).toHaveBeenCalledWith(['a', 'c'], ITEMS.length);
  });

  it('drop below all rows yields targetIndex = items.length', () => {
    const { onReorder, row } = setup();
    press(row('a'), 16);
    move(999);
    release(999);
    expect(onReorder).toHaveBeenCalledWith(['a'], ITEMS.length);
  });

  it('pointercancel during drag resets state without firing onReorder', () => {
    const { onReorder, row } = setup();
    press(row('a'), 16);
    move(64);
    fireEvent.pointerCancel(document, { pointerId: 1, clientX: 100, clientY: 64 });
    expect(onReorder).not.toHaveBeenCalled();
    expect(latest.draggedIds).toBeNull();
  });

  it('drop at the source row index is a no-op — does not fire onReorder', () => {
    const { onReorder, row } = setup();
    press(row('b'), 48);
    move(55); // engages
    move(48); // back to the source row
    release(48);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('a drop below a locked row cannot cross it', () => {
    const items: LayerListItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'wall', label: 'Wall', locked: true },
      { id: 'd', label: 'D' },
      { id: 'e', label: 'E' },
    ];
    const { onReorder, row } = setup(items);
    press(row('e'), 144);
    move(4);
    release(4);
    // Clamped to the first index below the wall, not to the top of the list.
    expect(onReorder).toHaveBeenCalledWith(['e'], 3);
  });

  it('a drop above a locked row cannot cross it', () => {
    const items: LayerListItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'wall', label: 'Wall', locked: true },
      { id: 'd', label: 'D' },
    ];
    const { onReorder, row } = setup(items);
    press(row('a'), 16);
    move(999);
    release(999);
    expect(onReorder).toHaveBeenCalledWith(['a'], 2);
  });

  it('drops selection members that sit on the far side of a wall', () => {
    const items: LayerListItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'wall', label: 'Wall', locked: true },
      { id: 'd', label: 'D' },
    ];
    const { onReorder, row } = setup(items, ['a', 'd']);
    press(row('a'), 16);
    move(999);
    release(999);
    // 'd' sits past the wall and is dropped from the drag; 'a' stops at it.
    expect(onReorder).toHaveBeenCalledWith(['a'], 2);
  });

  it('a locked row cannot be dragged at all', () => {
    const items: LayerListItem[] = [
      { id: 'wall', label: 'Wall', locked: true },
      { id: 'b', label: 'B' },
    ];
    const { onReorder, row } = setup(items);
    press(row('wall'), 16);
    move(999);
    release(999);
    expect(onReorder).not.toHaveBeenCalled();
    expect(latest.draggedIds).toBeNull();
  });

  it('state.draggedIds is null when idle, populated when actively dragging', () => {
    const { row } = setup(ITEMS, ['a', 'b']);
    expect(latest.draggedIds).toBeNull();
    press(row('a'), 16);
    expect(latest.draggedIds).toBeNull(); // still pending, sub-threshold
    move(64);
    expect(latest.draggedIds).toEqual(['a', 'b']);
    release(64);
    expect(latest.draggedIds).toBeNull();
  });

  it('keeps the drag alive when capture is lost and the list is still mounted', () => {
    const { onReorder, list, row } = setup();
    press(row('a'), 16);
    move(999);
    // Chrome releases capture a beat before it delivers pointerup, so ending
    // the drag here throws away a drop that has already been dispatched. The
    // other half of the rule — a detached origin does cancel — belongs to
    // pointerSession.test.ts, which owns it without React in the way.
    fireEvent(list, new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    expect(latest.draggedIds).toEqual(['a']);
    release(999);
    expect(onReorder).toHaveBeenCalledWith(['a'], ITEMS.length);
  });

  it('reads a move with no button held as the release that never arrived', () => {
    const { onReorder, row } = setup();
    press(row('a'), 16, { buttons: 1 });
    move(999, { buttons: 1 });
    expect(latest.draggedIds).toEqual(['a']);
    move(999, { buttons: 0 });
    expect(onReorder).toHaveBeenCalledWith(['a'], ITEMS.length);
    expect(latest.draggedIds).toBeNull();
  });

  it('commits even though the dragged row unmounted mid-gesture', () => {
    const { onReorder, row, rerender } = setup();
    press(row('d'), 112);
    move(20);
    rerender(ITEMS.filter((it) => it.id !== 'd'));
    release(20);
    expect(onReorder).toHaveBeenCalledWith(['d'], 0);
  });

  it('releases the pointer when the list unmounts mid-drag', () => {
    // Proxy assertion: jsdom's pointer capture records the call and retargets
    // nothing, so this can only show that the session tore itself down.
    const { onReorder, list, row, unmount } = setup();
    press(row('a'), 16);
    move(999);
    unmount();
    expect(list.releasePointerCapture).toHaveBeenCalledWith(1);
    release(999);
    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('useReorderDragList press intent', () => {
  it('reports a press that never crossed the drag threshold', () => {
    const { row, onPress, onReorder } = setup();
    press(row('b'), 40);
    release(40);
    expect(onPress).toHaveBeenCalledWith('b', expect.objectContaining({ shiftKey: false }));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('reports the modifiers held at press, not at release', () => {
    const { row, onPress } = setup();
    press(row('b'), 40, { shiftKey: true });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 40, shiftKey: false });
    expect(onPress).toHaveBeenCalledWith('b', expect.objectContaining({ shiftKey: true }));
  });

  it('does not report a press that became a drag', () => {
    const { row, onPress, onReorder } = setup();
    press(row('a'), 8);
    move(8);
    move(100);
    release(100);
    expect(onPress).not.toHaveBeenCalled();
    expect(onReorder).toHaveBeenCalled();
  });

  it('reports a press on a locked row, which can be selected but not dragged', () => {
    const items: LayerListItem[] = [{ id: 'a', label: 'A', locked: true }, ...ITEMS.slice(1)];
    const { row, onPress, onReorder } = setup(items);
    press(row('a'), 8);
    move(8);
    move(100);
    release(100);
    expect(onPress).toHaveBeenCalledWith('a', expect.anything());
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not report a press the session cancelled', () => {
    const { row, onPress } = setup();
    press(row('b'), 40);
    // pointercancel, not a lost capture: capture goes away on its own a beat
    // before every ordinary release, so it cannot be what cancels a session.
    fireEvent.pointerCancel(document, { pointerId: 1, clientX: 100, clientY: 40 });
    release(40);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports a press whose release the window never delivered', () => {
    const { row, onPress } = setup();
    // buttons: 1 on the press arms the missed-release rule; a move reporting
    // no held button is the release that landed on another window.
    press(row('c'), 72, { buttons: 1 });
    move(72, { buttons: 0 });
    expect(onPress).toHaveBeenCalledWith('c', expect.anything());
  });
});
