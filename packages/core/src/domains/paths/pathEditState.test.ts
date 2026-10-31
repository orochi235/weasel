import { describe, expect, it, vi } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from '../pathEffects';
import { createPathEditState, isSelectedNode } from './pathEditState';

describe('createPathEditState', () => {
  it('holds an id of its own, and notifies only when it changes', () => {
    const state = createPathEditState();
    const heard = vi.fn();
    state.subscribe(heard);
    expect(state.getEditingId()).toBe('');

    state.setEditingId('a');
    state.setEditingId('a');
    expect(state.getEditingId()).toBe('a');
    expect(heard).toHaveBeenCalledTimes(1);

    state.setEditingId(null);
    expect(state.getEditingId()).toBe('');
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('hands the selection overlay the same set until the id changes', () => {
    const state = createPathEditState();
    const none = state.getEditingIds();
    expect(none.size).toBe(0);
    state.setEditingId('a');
    const a = state.getEditingIds();
    expect([...a]).toEqual(['a']);
    expect(state.getEditingIds()).toBe(a);
    state.setEditingId(null);
    expect(state.getEditingIds()).toBe(none);
  });

  it('notifies on every anchor-selection and marquee write, and stops when unsubscribed', () => {
    const state = createPathEditState();
    const heard = vi.fn();
    const off = state.subscribe(heard);
    const anchors = new Set([1, 2]);
    const rect = { x: 0, y: 0, width: 4, height: 4 };
    state.setSelectedAnchors(anchors);
    state.setMarquee(rect);
    expect(state.getSelectedAnchors()).toBe(anchors);
    expect(state.getMarquee()).toBe(rect);
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    state.setMarquee(null);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('reads and writes the anchor selection through a host that owns it', () => {
    let held: ReadonlySet<number> = new Set([3]);
    const state = createPathEditState({
      host: () => ({
        editingId: () => 'a',
        setEditingId: () => {},
        selectedAnchors: () => held,
        setSelectedAnchors: (next) => { held = next; },
      }),
    });
    expect([...state.getSelectedAnchors()]).toEqual([3]);
    state.setSelectedAnchors(new Set([1, 2]));
    expect([...held]).toEqual([1, 2]);
  });

  it('reads an id as empty while the mode forbids anchor editing, and keeps it for when it is allowed again', () => {
    let allowed = true;
    const state = createPathEditState({ isAllowed: () => allowed });
    state.setEditingId('a');
    allowed = false;
    expect(state.getEditingId()).toBe('');
    expect(state.getEditingIds().size).toBe(0);
    allowed = true;
    expect(state.getEditingId()).toBe('a');
  });

  it('reads an id as empty while its node is missing or deselected, and keeps it for when it is back', () => {
    const selected = new Set(['a']);
    const state = createPathEditState({ isSelectedNode: (id) => selected.has(id) });
    state.setEditingId('a');
    expect(state.getEditingId()).toBe('a');
    selected.clear();
    expect(state.getEditingId()).toBe('');
    expect(state.getEditingIds().size).toBe(0);
    selected.add('a');
    expect(state.getEditingId()).toBe('a');
  });

  it("holds a host's id to the same rule", () => {
    let allowed = true;
    let selected = true;
    const state = createPathEditState({
      host: () => ({ editingId: () => 'h', setEditingId: () => {} }),
      isAllowed: () => allowed,
      isSelectedNode: () => selected,
    });
    expect(state.getEditingId()).toBe('h');
    allowed = false;
    expect(state.getEditingId()).toBe('');
    allowed = true;
    selected = false;
    expect(state.getEditingId()).toBe('');
  });

  it('leaves the id to a host: reads it there, writes it there, and announces nothing', () => {
    let hosted: string | null = 'h';
    const host = { editingId: () => hosted, setEditingId: vi.fn((id: string | null) => { hosted = id; }) };
    let current: typeof host | undefined = host;
    const state = createPathEditState({ host: () => current });
    const heard = vi.fn();
    state.subscribe(heard);

    expect(state.getEditingId()).toBe('h');
    state.setEditingId('b');
    expect(host.setEditingId).toHaveBeenLastCalledWith('b');
    expect(state.getEditingId()).toBe('b');
    expect(heard).not.toHaveBeenCalled();

    hosted = null;
    expect(state.getEditingId()).toBe('');

    current = undefined;
    expect(state.getEditingId()).toBe('');
  });

  it('still tells the subscribers after one that throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createPathEditState();
    const heard = vi.fn();
    state.subscribe(() => { throw new Error('boom'); });
    state.subscribe(heard);
    expect(() => state.setEditingId('a')).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});

describe('isSelectedNode', () => {
  const sceneWith = (hideSources: boolean) => createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: asNodeId('t'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 80, height: 20 }, data: { text: 'Hi' } },
      { id: asNodeId('p'), kind: 'mark', layer: 'main', pose: { x: 0, y: 50, width: 100, height: 1 }, data: { path: pathFromD('M0 50 L100 50') } },
      { ...pathEffectNode({ kind: 'textAlong', hideSources }, [asNodeId('t'), asNodeId('p')], 'main', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
    ],
  });

  it('counts the path a selected effect hides, so it can be anchor-edited through the effect', () => {
    expect(isSelectedNode(sceneWith(true), { current: ['fx'] }, 'p')).toBe(true);
    expect(isSelectedNode(sceneWith(true), { current: ['fx'] }, 't')).toBe(false);
    expect(isSelectedNode(sceneWith(false), { current: ['fx'] }, 'p')).toBe(false);
    expect(isSelectedNode(sceneWith(true), { current: [] }, 'p')).toBe(false);
  });
});
