import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { moveGestureAdapter } from './gestureAdapter';

interface D { color: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'container', layer: 'main', data: { color: '#eee' }, pose: { x: 0, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'leaf', layer: 'main', data: { color: '#f00' }, pose: { x: 10, y: 10, width: 20, height: 20 } });
  return { scene, box, leaf };
}

describe('moveGestureAdapter', () => {
  it('reads nodes, poses, and parents from the scene', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    expect(a.getNode(leaf as string)?.id).toBe(leaf);
    expect(a.getPose(leaf as string)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(a.getParent(leaf as string)).toBeNull();
    expect(a.getNodes().map((n) => n.id)).toContain(leaf);
  });

  it('setParent reparents and getParent reflects it', () => {
    const { scene, box, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    a.setParent(leaf as string, box as string);
    expect(scene.get(asNodeId(leaf as string))?.parent).toBe(box);
  });

  it('removeNode then insertNode round-trips a node', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    const node = a.getNode(leaf as string)!;
    a.removeNode(leaf as string);
    expect(scene.get(asNodeId(leaf as string))).toBeUndefined();
    a.insertNode(node);
    expect(scene.get(asNodeId(leaf as string))?.id).toBe(leaf);
  });
});
