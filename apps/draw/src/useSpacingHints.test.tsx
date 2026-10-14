import { act, renderHook } from '@testing-library/react';
import { createScene, type GestureContext, type NodeId, type SelectionApi } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { drawPrefs } from './prefs';
import { useSpacingHints } from './useSpacingHints';

beforeEach(() => act(() => drawPrefs().reset()));

function fixture() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default', visible: true, locked: false }],
  });
  const rect = (x: number) => scene.add({ kind: 'leaf', layer: 'default', pose: { x, y: 0, width: 10, height: 10 }, data: {} });
  rect(0);
  rect(30);
  const moving = rect(62);
  const selection = { get: () => [moving] } as unknown as SelectionApi;
  return { scene, selection, moving };
}

const drag = (id: NodeId, origin: WeaselDrawPose): GestureContext<WeaselDrawPose> => ({
  draggedIds: [id],
  origin: new Map([[id, origin]]),
  current: new Map(),
  snap: null,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
  view: null,
  adapter: {} as never,
  scratch: {},
});

describe('useSpacingHints', () => {
  it('snaps a moved shape to the spacing between its siblings and marks the equal gaps', () => {
    const { scene, selection, moving } = fixture();
    const { result } = renderHook(() => useSpacingHints(scene, selection));
    const { move, layer, readout } = result.current;
    expect(readout).toBeDefined();
    const res = move!.onMove!(drag(moving, scene.get(moving)!.pose), { kind: 'translate', dx: 0, dy: 0 });
    // Its gap to the middle shape is 22; the gap beside it is 20, within the snap.
    expect(res).toEqual({ transform: { kind: 'translate', dx: -2, dy: 0 } });
    const labels = layer!.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as never, { width: 200, height: 100 })
      .filter((c) => c.kind === 'text');
    expect(labels).toHaveLength(2);
  });

  it('offers nothing while the preference is off', () => {
    act(() => drawPrefs().set('view.spacingHints', false));
    const { scene, selection } = fixture();
    const { result } = renderHook(() => useSpacingHints(scene, selection));
    expect(result.current).toEqual({ move: undefined, layer: undefined, readout: undefined });
  });
});
