/**
 * `useSceneTextEdit` writes each keystroke through to a text node something derives from — a text-along node's
 * hidden text, whose curved copy follows the typing — and puts it back on a cancel. Any other node waits for the commit.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from '../pathEffects';
import { useSceneTextEdit } from './useSceneTextEdit';

const T = asNodeId('t');
const LONE = asNodeId('lone');
const P = asNodeId('p');
const FX = asNodeId('fx');
const BOX = { x: 0, y: 0, width: 200, height: 40 };

function setup() {
  const scene = createScene<{ text?: string; style?: { fontSize: number } }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'leaf', layer: 'main', pose: BOX, data: { text: 'hello', style: { fontSize: 16 } } },
      { id: LONE, kind: 'leaf', layer: 'main', pose: BOX, data: { text: 'alone', style: { fontSize: 16 } } },
      { id: P, kind: 'leaf', layer: 'main', pose: BOX, data: { path: pathFromD('M0 100 L200 100') } as never },
      { ...pathEffectNode({ kind: 'textAlong', hideSources: true }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX } as never,
    ],
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const hook = renderHook(() => useSceneTextEdit(scene, container));
  return { scene, container, hook };
}

function type(container: HTMLElement, ch: string): void {
  const overlay = container.querySelector<HTMLElement>('div[contenteditable="true"]')!;
  overlay.lastChild!.textContent += ch;
  act(() => { overlay.dispatchEvent(new Event('input', { bubbles: true })); });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('useSceneTextEdit — drafts', () => {
  it('writes each keystroke to a node something derives from', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    expect(scene.get(T)!.data.text).toBe('hello!');
    type(container, '?');
    expect(scene.get(T)!.data.text).toBe('hello!?');
    act(() => hook.result.current.commit());
    expect(scene.get(T)!.data.text).toBe('hello!?');
  });

  it('puts back the data the edit began with on a cancel', () => {
    const { scene, container, hook } = setup();
    const before = scene.get(T)!.data;
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    act(() => hook.result.current.cancelEdit());
    expect(scene.get(T)!.data).toEqual(before);
  });

  it('writes a node nothing derives from only at the commit', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('lone'));
    type(container, '!');
    expect(scene.get(LONE)!.data.text).toBe('alone');
    act(() => hook.result.current.commit());
    expect(scene.get(LONE)!.data.text).toBe('alone!');
  });

  it('makes a committed edit one undo entry, which undoes to the text before the first draft', () => {
    const { scene, container, hook } = setup();
    const before = scene.historyEntries().length;
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    type(container, '?');
    act(() => hook.result.current.commit());
    expect(scene.historyEntries()).toHaveLength(before + 1);
    scene.undo();
    expect(scene.get(T)!.data.text).toBe('hello');
  });

  it('leaves a canceled edit one entry that changes nothing, so an undo brings no draft back', () => {
    const { scene, container, hook } = setup();
    const before = scene.get(T)!.data;
    const entries = scene.historyEntries().length;
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    act(() => hook.result.current.cancelEdit());
    expect(scene.get(T)!.data).toEqual(before);
    expect(scene.historyEntries()).toHaveLength(entries + 1);
    scene.undo();
    expect(scene.get(T)!.data).toEqual(before);
  });

  it('keeps two edits of one node apart', () => {
    const { scene, container, hook } = setup();
    const before = scene.historyEntries().length;
    for (const ch of ['!', '?']) {
      act(() => hook.result.current.startEdit('t'));
      type(container, ch);
      act(() => hook.result.current.commit());
    }
    expect(scene.historyEntries()).toHaveLength(before + 2);
    scene.undo();
    expect(scene.get(T)!.data.text).toBe('hello!');
  });
});
