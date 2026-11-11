import { describe, expect, it } from 'vitest';
import { asNodeId } from '@weasel-js/core';
import { d3Bind } from './bind';
import { makeAnimator, makeScene } from './pbt.fixture';

const box = (x: number) => ({ x, y: 0, width: 1, height: 1 });

describe('shrunk from the d3 properties', () => {
  it('refuses a key held by a node on another layer before changing anything', () => {
    const scene = makeScene();
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'other', pose: box(0), data: {} });
    const steps = scene.historyIndex();
    expect(() => d3Bind(scene, [{ id: 'b' }, { id: 'a' }], { key: (d) => d.id }).pose(() => box(1)).join())
      .toThrow(/d3Bind\.join: key "a" is held by a mark on layer "other"/);
    expect(scene.get(asNodeId('b'))).toBeUndefined();
    expect(scene.historyIndex()).toBe(steps);
  });

  it('ends a pose transition and a numeric tween exactly at their targets', async () => {
    const scene = makeScene();
    const clock = makeAnimator();
    d3Bind(scene, [{ id: 'a', x: 0.7 }], { key: (d) => d.id }).pose((d) => box(d.x)).join();
    let v = 0;
    const done = d3Bind(scene, [{ id: 'a', x: 0.1 }], { key: (d) => d.id, animator: clock.animator }).pose((d) => box(d.x))
      .join().transition().duration(100)
      .tween({ name: 'v', from: () => -10.9, to: () => 21.2, apply: (_d, _id, got) => { v = got as number; } })
      .end();
    clock.advance(16);
    clock.advance(200);
    await done;
    expect(scene.get(asNodeId('a'))!.pose.x).toBe(0.1);
    expect(v).toBe(21.2);
    clock.dispose();
  });

  it('ends a tween at its target under an easing that stops short of 1', async () => {
    const scene = makeScene();
    const clock = makeAnimator();
    d3Bind(scene, [{ id: 'a', x: 0 }], { key: (d) => d.id }).pose((d) => box(d.x)).join();
    let v = 0;
    const done = d3Bind(scene, [{ id: 'a', x: 0.1 }], { key: (d) => d.id, animator: clock.animator }).pose((d) => box(d.x))
      .join().transition().duration(0).ease((t) => 1 - Math.cos((t * Math.PI) / 2))
      .tween({ name: 'v', from: () => 0, to: () => 0.1, apply: (_d, _id, got) => { v = got as number; } })
      .end();
    clock.advance(1);
    await done;
    expect(v).toBe(0.1);
    expect(scene.get(asNodeId('a'))!.pose.x).toBe(0.1);
    clock.dispose();
  });

  it('refuses a NaN duration where it is set, not from the frame or timer that would start the tween', () => {
    const scene = makeScene();
    const clock = makeAnimator();
    d3Bind(scene, [{ id: 'a' }], { key: (d) => d.id }).pose(() => box(0)).join();
    const t = d3Bind(scene, [{ id: 'a' }], { key: (d) => d.id, animator: clock.animator }).pose(() => box(1)).join().transition();
    expect(() => t.duration(NaN)).toThrow(/d3Bind\.transition\.duration: ms is a time, not NaN/);
    clock.dispose();
  });
});
