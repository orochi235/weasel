import { describe, it, expect } from 'vitest';
import { selectAllAction } from './selectAll';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';

describe('selectAllAction (descriptor)', () => {
  it('id="selectAll", label="Select All"', () => {
    expect(selectAllAction.id).toBe('selectAll');
    expect(selectAllAction.label).toBe('Select All');
  });

  it('defaultBinding = { kind: "key", key: "a", mods: { mod: true } }', () => {
    expect(selectAllAction.defaultBinding).toEqual({ kind: 'key', key: 'a', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(selectAllAction.invoker?.timing).toBe('immediate');
  });
});

describe('selectAllAction (behavior)', () => {
  const run = (scene: unknown): string[] => {
    const picked: string[][] = [];
    (selectAllAction.invoker as { run(deps: never, params: never): void }).run(
      { scene, selection: { set: (ids: string[]) => picked.push(ids) } } as never,
      undefined as never,
    );
    return picked[0] ?? [];
  };

  const sceneWithHiddenLayer = () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' as const }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.add({ kind: 'leaf', id: asNodeId('shown'), layer: 'base', data: { v: 1 }, pose: { x: 0 } });
    scene.add({ kind: 'leaf', id: asNodeId('hidden'), layer: 'fx', data: { v: 2 }, pose: { x: 0 } });
    return scene;
  };

  it('selects every node while both layers are visible', () => {
    expect(run(sceneWithHiddenLayer())).toEqual(['shown', 'hidden']);
  });

  it('skips nodes the user cannot see, so Cmd+A then Delete cannot take them', () => {
    const scene = sceneWithHiddenLayer();
    scene.setLayerVisible('fx', false);
    expect(run(scene)).toEqual(['shown']);
  });

  it('skips nodes on a locked layer, and takes them again once unlocked', () => {
    const scene = sceneWithHiddenLayer();
    scene.setLayerLocked('fx', true);
    expect(run(scene)).toEqual(['shown']);
    scene.setLayerLocked('fx', false);
    expect(run(scene)).toEqual(['shown', 'hidden']);
  });

  it('skips a child whose container sits on a locked layer', () => {
    const scene = sceneWithHiddenLayer();
    const box = scene.add({ kind: 'container', id: asNodeId('box'), layer: 'base', data: { v: 3 }, pose: { x: 0 } });
    scene.add({ kind: 'leaf', id: asNodeId('kid'), layer: 'fx', data: { v: 4 }, pose: { x: 0 }, parent: box });
    scene.setLayerLocked('base', true);
    expect(run(scene)).toEqual(['hidden']);
  });

  it('selects nothing when every layer is hidden', () => {
    const scene = sceneWithHiddenLayer();
    scene.setLayerVisible('base', false);
    scene.setLayerVisible('fx', false);
    expect(run(scene)).toEqual([]);
  });
});

describe('selectAllAction — the asking view', () => {
  it('leaves out a layer the asking view does not paint, though the scene shows it', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' as const }],
    });
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.add({ kind: 'leaf', id: asNodeId('shown'), layer: 'base', data: { v: 1 }, pose: { x: 0 } });
    scene.add({ kind: 'leaf', id: asNodeId('elsewhere'), layer: 'fx', data: { v: 2 }, pose: { x: 0 } });

    const picked: string[][] = [];
    (selectAllAction.invoker as { run(deps: never, params: never): void }).run(
      {
        scene,
        selection: { set: (ids: string[]) => picked.push(ids) },
        view: { layerIsPainted: (layer: string) => layer !== 'fx' },
      } as never,
      undefined as never,
    );

    expect(picked[0]).toEqual(['shown']);
  });

  it('declares the view dep, so a routed dispatch can hand it one', () => {
    expect(selectAllAction.requires).toContain('view');
  });
});
