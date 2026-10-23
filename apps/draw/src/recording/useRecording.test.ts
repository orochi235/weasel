import { describe, expect, it, vi } from 'vitest';
import { asNodeId, createScene, pathFromD } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from '../drawDocument';
import { baselineOf } from './useRecording';

const newScene = () =>
  createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });

describe('a recording baseline', () => {
  it('survives the recording file and puts the scene and the camera back', () => {
    const recorded = newScene();
    const path = pathFromD('M0 0 L10 0 L10 10 Z');
    recorded.add({
      kind: 'mark', layer: 'default', id: asNodeId('tri'),
      pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path },
    });
    const view = { x: 7, y: 8, scale: { x: 2, y: 2 } };
    const snapshot = baselineOf({ scene: recorded, view: () => view, setView: vi.fn() }).snapshot()!;
    const fromFile = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;

    const replayed = newScene();
    replayed.add({
      kind: 'mark', layer: 'default', id: asNodeId('stale'),
      pose: { x: 0, y: 0, width: 1, height: 1 }, data: {},
    });
    const setView = vi.fn();
    baselineOf({ scene: replayed, view: () => view, setView }).restore(fromFile);

    expect(replayed.roots).toEqual([asNodeId('tri')]);
    expect(replayed.get(asNodeId('tri'))!.data.path).toEqual(path);
    expect(setView).toHaveBeenCalledWith(view);
  });
});
