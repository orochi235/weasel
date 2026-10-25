import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { pathFromD } from '@weasel-js/geom';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { PATH_OVERLAY_ROLES } from 'canvas/pathOverlay';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';
import { useEffectSourcesLayer } from './useEffectSourcesLayer';

const T = asNodeId('t');
const P = asNodeId('p');
const FX = asNodeId('fx');
// A background makes the text's outline its box, so no face has to load.
const TEXT = { text: 'Hi', style: { fontSize: 16 }, background: { paint: { kind: 'solid', color: '#fff' } } };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function drawn(hideSources: boolean, selection: readonly NodeId[], foundHidden?: number[]): DrawCommand[] {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 80, height: 20 }, data: TEXT, hidden: hideSources },
      { id: P, kind: 'mark', layer: 'main', pose: { x: 0, y: 100, width: 100, height: 1 }, data: { path: pathFromD('M0 100 L100 100') }, hidden: hideSources },
      { ...pathEffectNode({ kind: 'textAlong', hideSources, ...(foundHidden ? { foundHidden } : {}) }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
    ],
  });
  const { result } = renderHook(() => useEffectSourcesLayer(scene));
  return result.current.draw({ getChromeState: () => ({ selection }) }, VIEW, { width: 200, height: 200, dpr: 1 });
}

const strokes = (cmds: readonly DrawCommand[]): DrawCommand[] => cmds.flatMap((c) =>
  c.kind === 'group' ? strokes((c as GroupDrawCommand).children) : c.kind === 'path' && c.stroke ? [c] : []);

describe('useEffectSourcesLayer', () => {
  it("strokes a selected text-along node's hidden text and path faintly in the chrome color, a screen pixel wide", () => {
    const out = drawn(true, [FX]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'group', alpha: 0.4 });
    const lines = strokes(out);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toMatchObject({ stroke: { paint: PATH_OVERLAY_ROLES['chrome']!.stroke, width: { px: 1 } } });
    }
  });

  it('leaves out a source that was hidden before the effect was made', () => {
    expect(strokes(drawn(true, [FX], [1]))).toHaveLength(1);
  });

  it('draws nothing when the node is not selected, or shows its sources', () => {
    expect(drawn(true, [])).toEqual([]);
    expect(drawn(true, [T])).toEqual([]);
    expect(drawn(false, [FX])).toEqual([]);
  });
});
