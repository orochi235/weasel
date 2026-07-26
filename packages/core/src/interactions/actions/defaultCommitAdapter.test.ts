import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { defaultCommitAdapter } from './defaultCommitAdapter';

interface D { color: string }
type L = 'main' | 'overlay';
interface P { x: number; y: number; width: number; height: number }

function fixture() {
  const scene = createScene<D, L, P>({
    systemLayers: [{ id: 'main' }, { id: 'overlay' }],
  });
  const box = scene.add({
    kind: 'container',
    layer: 'main',
    data: { color: '#eee' },
    pose: { x: 0, y: 0, width: 200, height: 200 },
  });
  const leaf = scene.add({
    kind: 'leaf',
    layer: 'main',
    data: { color: '#f00' },
    pose: { x: 10, y: 10, width: 20, height: 20 },
  });
  return { scene, box, leaf };
}

describe('defaultCommitAdapter', () => {
  it('reads nodes, poses, and parents from the scene', () => {
    const { scene, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    expect(a.getNode(leaf as string)?.id).toBe(leaf);
    expect(a.getPose(leaf as string)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(a.getParent(leaf as string)).toBeNull();
    expect(a.getNodes().map((n) => n!.id)).toContain(leaf);
  });

  it('setPose writes the pose into the scene', () => {
    const { scene, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    a.setPose(leaf as string, { x: 5, y: 6, width: 7, height: 8 });
    expect(scene.get(asNodeId(leaf as string))?.pose).toEqual({ x: 5, y: 6, width: 7, height: 8 });
  });

  it('setData writes the data payload into the scene', () => {
    const { scene, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    a.setData(leaf as string, { color: '#0f0' });
    expect(scene.get(asNodeId(leaf as string))?.data).toEqual({ color: '#0f0' });
  });

  it('setLayer writes the layer tag into the scene', () => {
    const { scene, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    a.setLayer(leaf as string, 'overlay');
    expect(scene.get(asNodeId(leaf as string))?.layer).toBe('overlay');
  });

  it('setParent reparents in the scene', () => {
    const { scene, box, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    a.setParent(leaf as string, box as string);
    expect(scene.get(asNodeId(leaf as string))?.parent).toBe(box);
  });

  it('removeNode then insertNode round-trips a node', () => {
    const { scene, leaf } = fixture();
    const a = defaultCommitAdapter<P>(scene);
    const node = a.getNode(leaf as string)!;
    a.removeNode(leaf as string);
    expect(scene.get(asNodeId(leaf as string))).toBeUndefined();
    a.insertNode(node);
    expect(scene.get(asNodeId(leaf as string))?.id).toBe(leaf);
  });
});
