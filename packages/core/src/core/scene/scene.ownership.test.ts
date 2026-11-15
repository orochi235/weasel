import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId, type RectPose } from './types';

const at = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const A = asNodeId('a');

interface Data { label: string; tags: string[]; bytes?: Float32Array }

function setup(data: Data = { label: 'a', tags: ['t'] }) {
  return createScene<Data, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [{ id: A, kind: 'mark', layer: 'l', pose: at(0), data }],
  });
}

describe('Scene ownership of poses and data', () => {
  it('refuses a write into a pose read back from the scene', () => {
    const scene = setup();
    expect(() => { (scene.get(A)!.pose as { x: number }).x = 99; }).toThrow(TypeError);
    expect(scene.get(A)!.pose.x).toBe(0);
  });

  it('refuses a write into a pose after handing it to setPose', () => {
    const scene = setup();
    const next = at(5);
    scene.setPose(A, next);
    expect(() => { next.x = 99; }).toThrow(TypeError);
  });

  it('keeps undo honest: the pose history recorded cannot be rewritten', () => {
    const scene = setup();
    scene.setPose(A, at(5));
    expect(() => { (scene.get(A)!.pose as { x: number }).x = 99; }).toThrow(TypeError);
    scene.undo();
    scene.redo();
    expect(scene.get(A)!.pose.x).toBe(5);
  });

  it('freezes data deeply, but leaves typed arrays writable', () => {
    const scene = setup({ label: 'a', tags: ['t'], bytes: new Float32Array(2) });
    const data = scene.get(A)!.data;
    expect(() => { data.tags.push('u'); }).toThrow(TypeError);
    data.bytes![0] = 1;
    expect(data.bytes![0]).toBe(1);
  });

  it('leaves a toJSON snapshot as it was through later edits', () => {
    const scene = setup();
    const before = scene.toJSON();
    scene.setPose(A, at(5));
    scene.update(A, { data: { label: 'b', tags: [] } });
    expect(before.nodes[0].pose.x).toBe(0);
    expect(before.nodes[0].data.label).toBe('a');
  });

  it('detaches a toJSON snapshot from typed arrays the scene still holds', () => {
    const scene = setup({ label: 'a', tags: [], bytes: new Float32Array([1, 2]) });
    const before = scene.toJSON();
    scene.get(A)!.data.bytes![0] = 9;
    expect(before.nodes[0].data.bytes![0]).toBe(1);
    before.nodes[0].data.tags.push('mine');
    expect(scene.get(A)!.data.tags).toEqual([]);
  });

  it('loads a save without freezing it', () => {
    const json = setup().toJSON();
    const scene = setup();
    scene.loadState(json);
    json.nodes[0].data.tags.push('later');
    expect(scene.get(A)!.data.tags).toEqual(['t']);
  });

  it('hands out a live view: a held node shows later edits', () => {
    const scene = setup();
    const held = scene.get(A)!;
    scene.setPose(A, at(5));
    expect(held.pose.x).toBe(5);
    expect(scene.get(A)).toBe(held);
  });
});
