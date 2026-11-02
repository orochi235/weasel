import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { createEvent, fireEvent, render } from '@testing-library/react';
import { PointerContextProvider, createPointerStore } from '@weasel-js/routing/react';
import { usePublishPointer } from './usePublishPointer';

function Surface({ viewId }: { viewId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePublishPointer(ref, (_id, x, y) => ({ world: { x: x / 2, y: y / 2 }, viewId }));
  return <div ref={ref} data-testid={viewId} />;
}

function mount() {
  const store = createPointerStore();
  const r = render(
    <PointerContextProvider store={store}>
      <Surface viewId="a" />
      <Surface viewId="b" />
    </PointerContextProvider>,
  );
  return { store, a: r.getByTestId('a'), b: r.getByTestId('b') };
}

function moveAt(el: Element | Document, clientX: number, clientY: number, buttons = 0) {
  const ev = createEvent.pointerMove(el, { pointerId: 1, buttons });
  Object.defineProperty(ev, 'clientX', { value: clientX });
  Object.defineProperty(ev, 'clientY', { value: clientY });
  fireEvent(el, ev);
}

describe('usePublishPointer', () => {
  it('publishes the located point and clears on a free leave', () => {
    const { store, a } = mount();
    moveAt(a, 20, 40);
    expect(store.get()).toEqual({ world: { x: 10, y: 20 }, viewId: 'a' });
    fireEvent.pointerLeave(a);
    expect(store.get()).toBeNull();
  });

  it('keeps reporting a press that began on the element once it leaves', () => {
    const { store, a } = mount();
    fireEvent.pointerDown(a, { pointerId: 1, buttons: 1 });
    fireEvent.pointerLeave(a, { pointerId: 1, buttons: 1 });
    expect(store.get()).not.toBeNull();
    moveAt(document.body, 300, 8, 1);
    expect(store.get()).toEqual({ world: { x: 150, y: 4 }, viewId: 'a' });
  });

  it("does not clear another view's pointer when it leaves", () => {
    const { store, a, b } = mount();
    moveAt(a, 2, 2);
    moveAt(b, 6, 6);
    fireEvent.pointerLeave(a);
    expect(store.get()).toEqual({ world: { x: 3, y: 3 }, viewId: 'b' });
  });
});
