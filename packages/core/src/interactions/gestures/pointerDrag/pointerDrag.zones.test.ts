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

describe('useDragHandle press', () => {
  it('reads the getPayload of the latest render when the threshold is crossed', () => {
    document.body.innerHTML = '<div id="src"></div>';
    const first = vi.fn(() => ({ kind: 'item', ids: ['old'] }));
    const second = vi.fn(() => ({ kind: 'item', ids: ['new'] }));
    const { result, rerender } = renderHook(({ get }) => useDragHandle(get), { initialProps: { get: first } });
    press(result.current, document.getElementById('src')!);
    rerender({ get: second });
    firePointer('pointermove', 30, 0);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    firePointer('pointerup', 30, 0);
  });

  it('does not start a drag from a press on an SVG icon inside a button', () => {
    document.body.innerHTML = '<div id="src"><button><svg><path id="icon"></path></svg></button></div>';
    const getPayload = vi.fn(() => ({ kind: 'item', ids: ['a'] }));
    const { result } = renderHook(() => useDragHandle(getPayload));
    press(result.current, document.getElementById('src')!, document.getElementById('icon')!);
    firePointer('pointermove', 100, 0);
    expect(getPayload).not.toHaveBeenCalled();
    firePointer('pointerup', 100, 0);
  });
});

describe('the default drag ghost', () => {
  it('carries none of its source tree\'s ids', () => {
    document.body.innerHTML = '<div id="src"><label id="lbl">row</label></div>';
    const { result } = renderHook(() => useDragHandle(() => ({ kind: 'row', ids: ['a'] })));
    press(result.current, document.getElementById('src')!);
    firePointer('pointermove', 100, 60);
    expect(document.querySelectorAll('#src')).toHaveLength(1);
    expect(document.querySelectorAll('#lbl')).toHaveLength(1);
    firePointer('pointerup', 100, 60);
  });

  it("is sized in its seat's own px, so a seat drawn at twice its size shows it at the source's size", () => {
    document.body.innerHTML = '<div id="host" data-wzl-theme="x" style="transform: scale(2)"><div id="src">row</div></div>';
    const host = document.getElementById('host')!;
    Object.defineProperty(host, 'offsetWidth', { value: 100 });
    Object.defineProperty(host, 'offsetHeight', { value: 50 });
    host.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 100 });
    const src = document.getElementById('src')!;
    src.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 80, height: 20 });
    const { result } = renderHook(() => useDragHandle(() => ({ kind: 'row', ids: ['a'] })));
    press(result.current, src);
    firePointer('pointermove', 100, 60);
    const ghost = host.lastElementChild as HTMLElement;
    expect(ghost.style.width).toBe('40px');
    expect(ghost.style.height).toBe('10px');
    firePointer('pointerup', 100, 60);
  });
});

describe('useDragHandle in another document', () => {
  it('resolves zones in the source document, not the global one', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<div id="zone"></div><div id="src"></div>';
    const onDrop = vi.fn();
    zone(doc.getElementById('zone')!, { accepts: () => true, onDrop });
    Object.defineProperty(doc, 'elementFromPoint', { configurable: true, value: () => doc.getElementById('zone') });
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
    const { result } = renderHook(() => useDragHandle(() => ({ kind: 'item', ids: ['a'] })));
    press(result.current, doc.getElementById('src')!);
    for (const [type, x] of [['pointermove', 30], ['pointermove', 40], ['pointerup', 40]] as const) {
      const ev = new Event(type) as PointerEvent;
      Object.assign(ev, { clientX: x, clientY: 0, pointerId: 1, pointerType: 'mouse', button: 0 });
      doc.dispatchEvent(ev);
    }
    expect(onDrop).toHaveBeenCalledOnce();
  });
});

describe('the default ghost', () => {
  it('leaves the source row\'s checked radio checked', () => {
    document.body.innerHTML = '<div id="src"><input type="radio" name="g" id="r" checked></div><input type="radio" name="g">';
    const radio = document.getElementById('r') as HTMLInputElement;
    const { result } = renderHook(() => useDragHandle(() => ({ kind: 'item', ids: ['a'] })));
    press(result.current, document.getElementById('src')!);
    firePointer('pointermove', 30, 0);
    firePointer('pointermove', 40, 0);
    expect(document.querySelectorAll('[name="g"]')).toHaveLength(2);
    expect(radio.checked).toBe(true);
    firePointer('pointerup', 40, 0);
    expect(radio.checked).toBe(true);
  });
});
