import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { useSceneAdapter } from 'canvas/sceneAdapter';
import { useSceneSelectTool } from './useSceneSelectTool';

type Pose = { x: number; y: number; width: number; height: number };

afterEach(() => { cleanup(); });

describe('useSceneSelectTool after an abandoned render', () => {
  it('places plane chrome through the committed getView', () => {
    // The backdrop follows the camera at a quarter of its pan, so a camera at
    // x=400 puts a node stored at x=0 under x=300; at the origin it stays put.
    const a = (): View => ({ x: 400, y: 0, scale: { x: 1, y: 1 } });
    const b = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    let boundsOf!: (id: string) => unknown;
    function Probe({ getView }: { getView: () => View }) {
      const scene = useScene<unknown, 'back', Pose>({
        systemLayers: [{ id: 'back', parallax: { pan: 0.25 } }],
        initial: [{ id: asNodeId('hill'), kind: 'leaf', layer: 'back', pose: { x: 0, y: 0, width: 50, height: 50 }, data: {} }],
      });
      const adapter = useSceneAdapter(scene);
      boundsOf = useSceneSelectTool({ scene, adapter, getView }).boundsOf;
      return null;
    }
    renderThenAbandon(a, b, (getView) => <Probe getView={getView} />);
    expect(boundsOf('hill')).toEqual({ x: 300, y: 0, width: 50, height: 50 });
  });
});
