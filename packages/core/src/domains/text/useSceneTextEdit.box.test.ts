/**
 * A text node with `padding` lays its lines out in an inset box. The editor
 * has to agree with the painter, or the caret opens where the glyphs are not.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { useScene } from '../../core/scene/useScene';
import { solid } from '../../util/paint';
import { asNodeId } from '../../core/scene/types';
import { useSceneTextEdit, type UseSceneTextEditOptions } from './useSceneTextEdit';
import { DEFAULT_TEXT_STYLE } from '@weasel-js/text';

const STICKY = {
  id: 's', x: 100, y: 50, width: 200, height: 120,
  text: 'hi', style: { fontSize: 16 }, padding: 10,
};

function mount(item: Record<string, unknown>, options: UseSceneTextEditOptions<typeof STICKY> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const hook = renderHook(() => {
    const scene = useScene({ items: [item as typeof STICKY] });
    return useSceneTextEdit(scene, container, options);
  });
  const dblclick = (x: number, y: number) => act(() => hook.result.current.onDoubleClick({
    target: canvas, clientX: x, clientY: y,
  } as unknown as MouseEvent<HTMLElement>));
  return { hook, container, dblclick };
}

const overlayOf = (c: HTMLElement): HTMLDivElement => c.querySelector('div[contenteditable="true"]')!;

describe('useSceneTextEdit — padding', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the overlay over the padded box', () => {
    const { hook, container } = mount(STICKY);
    act(() => hook.result.current.startEdit('s'));
    const el = overlayOf(container);
    expect(el.style.left).toBe('110px');
    expect(el.style.top).toBe('60px');
    expect(el.style.minWidth).toBe('180px');
  });

  it('opens on a double-click in the padding', () => {
    const { hook, dblclick } = mount({ ...STICKY, background: { paint: solid('#ffe97a') } });
    dblclick(295, 165);
    expect(hook.result.current.editingId).toBe('s');
  });

  it('scrolls the overlay in the whole box when the node clips, padding included', () => {
    const { hook, container } = mount({ ...STICKY, overflow: 'clip' });
    act(() => hook.result.current.startEdit('s'));
    const el = overlayOf(container);
    const box = el.parentElement!;
    expect(box.style.overflow).toBe('auto');
    expect([box.style.left, box.style.top, box.style.width, box.style.height])
      .toEqual(['100px', '50px', '200px', '120px']);
    // The padding is the overlay's own, so its text sits in the inset box.
    expect([el.style.left, el.style.paddingLeft, el.style.paddingTop, el.style.width])
      .toEqual(['0px', '10px', '10px', '200px']);
  });

  it('leaves the overlay unscrolled when the node does not clip', () => {
    const { hook, container } = mount(STICKY);
    act(() => hook.result.current.startEdit('s'));
    expect(overlayOf(container).parentElement!.style.overflow).toBe('visible');
  });

  it('opens on no double-click outside the box', () => {
    const { hook, dblclick } = mount(STICKY);
    dblclick(305, 165);
    expect(hook.result.current.editingId).toBeNull();
  });
});

describe('useSceneTextEdit — font size', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sets a node with no font size of its own at the size the canvas lays it out at', () => {
    const { hook, container } = mount({ ...STICKY, style: {} }, { defaultFontSize: 24 });
    act(() => hook.result.current.startEdit('s'));
    expect(overlayOf(container).style.fontSize).toBe(`${DEFAULT_TEXT_STYLE.fontSize}px`);
  });
});

describe('useSceneTextEdit — drawOne', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const node = (id: string) => ({
    id: asNodeId(id), kind: 'mark' as const, layer: 'default', parent: null,
    pose: { x: 0, y: 0, width: 100, height: 80 },
    data: { text: 'hi', background: { paint: solid('#ffe97a') } },
  });

  it('drops the glyphs of the node being edited and keeps its background', () => {
    const { hook } = mount(STICKY);
    act(() => hook.result.current.startEdit('s'));
    const n = node('s');
    expect(hook.result.current.drawOne(n, n.pose).map((c) => c.kind)).toEqual(['path']);
  });

  it('drops the glyphs of a node being edited that clips them', () => {
    const { hook } = mount(STICKY);
    act(() => hook.result.current.startEdit('s'));
    const n = node('s');
    const clipped = { ...n, data: { ...n.data, overflow: 'clip' } };
    expect(hook.result.current.drawOne(clipped, n.pose).map((c) => c.kind)).toEqual(['path']);
  });

  it('paints every other node whole', () => {
    const { hook } = mount(STICKY);
    act(() => hook.result.current.startEdit('s'));
    const n = node('other');
    expect(hook.result.current.drawOne(n, n.pose).map((c) => c.kind)).toEqual(['path', 'text']);
  });
});
