import { createScene, type RectPose } from '@weasel-js/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editStamp } from '../undo/editStamp';
import { sceneTrialHistory, stampSceneEdits } from './sceneTrialHistory';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const make = () => createScene<{ n: number }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sceneTrialHistory', () => {
  it('stamps a scene edit after a mark made in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    const scene = make();
    const stamps = new Map<number, number>();
    const stop = stampSceneEdits(scene, stamps);
    const source = sceneTrialHistory(scene, stamps);
    const mark = editStamp();
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 1 } });
    expect(source.undoStamp?.()).toBeGreaterThan(mark);
    scene.undo();
    expect(source.redoStamp?.()).toBeGreaterThan(mark);
    expect(editStamp()).toBeGreaterThan(source.redoStamp?.() ?? Number.POSITIVE_INFINITY);
    stop();
  });

  it("falls back to the scene's own timestamps for edits made before stamping began", () => {
    const scene = make();
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 1 } });
    const source = sceneTrialHistory(scene, new Map());
    expect(source.undoStamp?.()).toBe(scene.history.timestampAt(0));
  });

  it('drops what the scene could redo, keeping what it can undo', () => {
    const scene = make();
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 1 } });
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n: 2 } });
    scene.undo();
    const source = sceneTrialHistory(scene);
    source.dropRedo?.();
    expect(source.canRedo()).toBe(false);
    expect(source.canUndo()).toBe(true);
  });

  it('forgets the stamps of entries the scene no longer holds', () => {
    const scene = make();
    const stamps = new Map<number, number>();
    const stop = stampSceneEdits(scene, stamps);
    for (let n = 0; n < 200; n++) {
      scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { n } });
      scene.undo();
    }
    expect(stamps.size).toBeLessThan(40);
    stop();
  });
});
