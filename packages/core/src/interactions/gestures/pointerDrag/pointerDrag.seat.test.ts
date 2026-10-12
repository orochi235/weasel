import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragHandle } from './pointerDrag';

beforeAll(() => {
  if (!('elementFromPoint' in document)) {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, writable: true, value: () => null });
  }
});

afterEach(() => { document.body.innerHTML = ''; });

function firePointer(type: string, clientX: number, clientY: number) {
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX, clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
  document.dispatchEvent(ev);
}

/** Press `source` and drag it to (100, 60); the ghost is whatever the drag added beside the source's tree. */
function dragFrom(source: HTMLElement): void {
  const { result } = renderHook(() => useDragHandle(() => ({ kind: 'row', ids: ['a'] })));
  result.current.onPointerDown({
    pointerType: 'mouse', button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: source, target: source,
  } as unknown as React.PointerEvent<HTMLElement>);
  firePointer('pointermove', 100, 60);
}

describe('the default drag ghost', () => {
  it('mounts on the body when the source sits in no themed host', () => {
    document.body.innerHTML = '<div id="src">row</div>';
    dragFrom(document.getElementById('src')!);
    const ghost = document.body.lastElementChild as HTMLElement;
    expect(ghost.id).toBe('src');
    expect(ghost).not.toBe(document.getElementById('src'));
    expect(ghost.style.transform).toContain('translate(100px, 60px)');
    firePointer('pointerup', 100, 60);
  });

  it("mounts in the source's themed host, placed from the host's corner when the host contains fixed boxes", () => {
    document.body.innerHTML = '<div id="host" data-wzl-theme="x" style="transform: translate(1px, 0)"><div id="src">row</div></div>';
    const host = document.getElementById('host')!;
    host.getBoundingClientRect = () => ({ left: 40, top: 25, right: 0, bottom: 0, width: 0, height: 0, x: 40, y: 25, toJSON: () => ({}) });
    dragFrom(document.getElementById('src')!);
    const ghost = host.lastElementChild as HTMLElement;
    expect(ghost).not.toBe(document.getElementById('src'));
    expect(ghost.parentElement).toBe(host);
    expect(ghost.style.transform).toContain('translate(60px, 35px)');
    firePointer('pointerup', 100, 60);
    expect(host.children).toHaveLength(1);
  });
});
