/**
 * `useSceneTextEdit` shows each keystroke to what derives from the edited node — a text-along node's hidden text,
 * whose curved copy follows the typing — through a data override, so the document holds nothing of the edit until
 * its commit, and a cancel or an undo cannot bring a draft back.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD } from '@weasel-js/geom';
import type { Fill } from '@weasel-js/paint';
import { loadTextOutlines } from '@weasel-js/text';
import { sceneDerivedPathOf } from 'canvas/derivedPath';
import { derivedPartsOf } from 'core/scene/derivedParts';
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
const RED: Fill = { paint: { kind: 'solid', color: '#ff0000' } };
const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const STYLE = { fontFamily: 'bars', fontSize: 16 };

function setup() {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  const scene = createScene<{ text?: string; style?: { fontFamily?: string; fontSize: number }; fill?: Fill }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: BOX, data: { text: 'hello', style: STYLE } },
      { id: LONE, kind: 'mark', layer: 'main', pose: BOX, data: { text: 'alone', style: { fontSize: 16 } } },
      { id: P, kind: 'mark', layer: 'main', pose: BOX, data: { path: pathFromD('M0 100 L200 100') } as never },
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
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

/** How many glyphs the text-along node lays along its path. */
function glyphsAlong(scene: ReturnType<typeof setup>['scene']): number {
  return derivedPartsOf(sceneDerivedPathOf(scene)(scene.get(FX)!))?.length ?? 0;
}

describe('useSceneTextEdit — drafts', () => {
  it('re-derives what derives from the node on each keystroke, writing the document only at the commit', async () => {
    const { scene, container, hook } = setup();
    await loadTextOutlines({ text: 'hello', style: STYLE });
    const stored = scene.get(T)!.data;
    expect(glyphsAlong(scene)).toBe(5);
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    expect(glyphsAlong(scene)).toBe(6);
    type(container, '?');
    expect(glyphsAlong(scene)).toBe(7);
    expect(scene.get(T)!.data).toBe(stored);
    act(() => hook.result.current.commit());
    expect(scene.get(T)!.data.text).toBe('hello!?');
    expect(scene.overrides.ids()).toEqual([]);
    expect(glyphsAlong(scene)).toBe(7);
  });

  it('shows a recorded write made during the edit beside the draft', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    scene.update(T, { data: { ...scene.get(T)!.data, fill: RED } });
    const shown = scene.overrides.read(T)?.data?.(scene.get(T)!.data);
    expect(shown).toEqual({ text: 'hello!', style: STYLE, fill: RED });
  });

  it('leaves the data the edit began with on a cancel, and shows it again', () => {
    const { scene, container, hook } = setup();
    const before = scene.get(T)!.data;
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    act(() => hook.result.current.cancelEdit());
    expect(scene.get(T)!.data).toBe(before);
    expect(scene.overrides.ids()).toEqual([]);
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

  it('leaves a canceled edit no history entry, and the redo stack as it was', () => {
    const { scene, container, hook } = setup();
    scene.update(LONE, { data: { text: 'renamed', style: { fontSize: 16 } } });
    scene.undo();
    const before = scene.get(T)!.data;
    const entries = scene.historyEntries();
    const at = scene.historyIndex();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    act(() => hook.result.current.cancelEdit());
    expect(scene.get(T)!.data).toEqual(before);
    expect(scene.historyEntries()).toEqual(entries);
    expect(scene.historyIndex()).toBe(at);
    expect(scene.redo()).toBe(true);
    expect(scene.get(LONE)!.data.text).toBe('renamed');
    expect(scene.get(T)!.data).toEqual(before);
  });

  it('redoes a committed edit to its last draft', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    type(container, '?');
    act(() => hook.result.current.commit());
    scene.undo();
    expect(scene.get(T)!.data.text).toBe('hello');
    scene.redo();
    expect(scene.get(T)!.data.text).toBe('hello!?');
  });

  it('keeps a write made to the node during the edit through a cancel, and undoes it with no draft coming back', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    scene.update(T, { data: { ...scene.get(T)!.data, fill: RED } });
    act(() => hook.result.current.cancelEdit());
    expect(scene.get(T)!.data).toEqual({ text: 'hello', style: STYLE, fill: RED });
    scene.undo();
    expect(scene.get(T)!.data).toEqual({ text: 'hello', style: STYLE });
    scene.redo();
    expect(scene.get(T)!.data).toEqual({ text: 'hello', style: STYLE, fill: RED });
  });

  it('keeps a write made to the node during the edit through a commit, which undoes to before the edit only', () => {
    const { scene, container, hook } = setup();
    act(() => hook.result.current.startEdit('t'));
    type(container, '!');
    scene.update(T, { data: { ...scene.get(T)!.data, fill: RED } });
    type(container, '?');
    act(() => hook.result.current.commit());
    expect(scene.get(T)!.data).toEqual({ text: 'hello!?', style: STYLE, fill: RED });
    scene.undo();
    expect(scene.get(T)!.data).toEqual({ text: 'hello', style: STYLE, fill: RED });
    scene.undo();
    expect(scene.get(T)!.data.fill).toBeUndefined();
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

  it('keeps edits of one node by two hook instances apart', () => {
    const { scene, container, hook } = setup();
    const other = document.createElement('div');
    document.body.appendChild(other);
    const second = renderHook(() => useSceneTextEdit(scene, other));
    const before = scene.historyEntries().length;
    for (const [h, c, ch] of [[hook, container, '!'], [second, other, '?']] as const) {
      act(() => h.result.current.startEdit('t'));
      type(c, ch);
      act(() => h.result.current.commit());
    }
    expect(scene.get(T)!.data.text).toBe('hello!?');
    expect(scene.historyEntries()).toHaveLength(before + 2);
    scene.undo();
    expect(scene.get(T)!.data.text).toBe('hello!');
  });
});
