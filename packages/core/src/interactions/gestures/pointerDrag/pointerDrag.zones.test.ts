import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragHandle, useDropZone, type DragPayload, type DropZoneOptions } from './pointerDrag';

beforeAll(() => {
  if (!('elementFromPoint' in document)) {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, writable: true, value: () => null });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function firePointer(type: string, clientX: number, clientY: number) {
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX, clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
  document.dispatchEvent(ev);
}

function zone(el: HTMLElement, opts: DropZoneOptions) {
  const { result } = renderHook(() => useDropZone<HTMLElement>(opts));
  result.current(el);
}

function press(handle: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void }, source: HTMLElement, target: Element = source) {
  handle.onPointerDown({
    pointerType: 'mouse', button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: source, target,
  } as unknown as React.PointerEvent<HTMLElement>);
}

/** Press `source`, drag past the threshold, and release at the point `under` answers for. */
function dragOnto(source: HTMLElement, under: Element, payload: DragPayload = { kind: 'item', ids: ['a'] }) {
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(under);
  const { result } = renderHook(() => useDragHandle(() => payload));
  press(result.current, source);
  firePointer('pointermove', 30, 0);
  firePointer('pointermove', 40, 0);
  firePointer('pointerup', 40, 0);
}

describe('useDropZone resolution', () => {
  it('drops into the innermost zone under the pointer, whichever registered first', () => {
    document.body.innerHTML = '<div id="outer"><div id="inner"><span id="leaf"></span></div></div><div id="src"></div>';
    const outerDrop = vi.fn();
    const innerDrop = vi.fn();
    zone(document.getElementById('outer')!, { accepts: () => true, onDrop: outerDrop });
    zone(document.getElementById('inner')!, { accepts: () => true, onDrop: innerDrop });
    dragOnto(document.getElementById('src')!, document.getElementById('leaf')!);
    expect(innerDrop).toHaveBeenCalledTimes(1);
    expect(outerDrop).not.toHaveBeenCalled();
  });

  it('falls back to the enclosing zone when the inner one refuses the kind', () => {
    document.body.innerHTML = '<div id="outer"><div id="inner"></div></div><div id="src"></div>';
    const outerDrop = vi.fn();
    zone(document.getElementById('inner')!, { accepts: () => false, onDrop: vi.fn() });
    zone(document.getElementById('outer')!, { accepts: () => true, onDrop: outerDrop });
    dragOnto(document.getElementById('src')!, document.getElementById('inner')!);
    expect(outerDrop).toHaveBeenCalledTimes(1);
  });

  it('a zone whose accepts throws is passed over, and the next drag still starts', () => {
    document.body.innerHTML = '<div id="bad"></div><div id="good"></div><div id="src"></div>';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    zone(document.getElementById('bad')!, { accepts: () => { throw new Error('boom'); }, onDrop: vi.fn() });
    const goodDrop = vi.fn();
    zone(document.getElementById('good')!, { accepts: () => true, onDrop: goodDrop });
    const src = document.getElementById('src')!;
    expect(() => dragOnto(src, document.getElementById('bad')!)).not.toThrow();
    vi.mocked(document.elementFromPoint).mockRestore();
    dragOnto(src, document.getElementById('good')!);
    expect(goodDrop).toHaveBeenCalledTimes(1);
  });
});
