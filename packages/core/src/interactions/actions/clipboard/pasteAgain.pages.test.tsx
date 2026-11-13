/** Pasting again in a paged scene: each paste steps on from the last in the world, whatever page it landed on. */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { PAGE_B, pagedScene } from 'core/pages/pagedFixture';
import type { RectPose } from 'core/scene/types';
import { useClipboardOps } from './clipboardOps';

describe('useClipboardOps pasting again', () => {
  it('lands each paste of a node on the second page 12 px on from the one before', () => {
    const { scene } = pagedScene();
    const onB = scene.add({ kind: 'mark', layer: 'ink', parent: PAGE_B, pose: { x: 20, y: 10, width: 20, height: 10 }, data: {} });
    const adapter = sceneToAdapter(scene);
    const pasted: string[][] = [];
    const { result } = renderHook(() => useClipboardOps(adapter as never, {
      getSelection: () => [onB],
      onPaste: (ids) => pasted.push(ids),
      produceFlavors: () => ({}),
    }));
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    act(() => { result.current.paste(); });
    const worldX = pasted.flat().map((id) => (adapter.getWorldPose(id) as RectPose).x);
    // Page b starts at world x 110, so the original sits at 130.
    expect(worldX).toEqual([142, 154]);
  });
});
