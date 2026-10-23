import { describe, expect, it } from 'vitest';
import { PathBuilder, type PolygonPath } from '@weasel-js/core';
import { parseSvg, serializeSvg } from '@weasel-js/svg';
import { objToSvgNode, svgNodesToSceneDrafts, SWILL_NAMESPACES, type SceneDraft } from './svgInterop';
import type { PathObj } from './svgObj';

describe('a variable-width stroke in a saved document', () => {
  it('survives a save and an open', () => {
    const vertexWidths = [2, 9];
    const nib = { angle: Math.PI / 6, ratio: 0.2 };
    const obj: PathObj = {
      id: 'a', tool: 'pen', x: 0, y: 0, width: 100, height: 40,
      path: new PathBuilder().moveTo(0, 0).curveTo(30, 40, 70, 40, 100, 0).build() as PolygonPath,
      fill: null,
      stroke: { paint: { color: '#123456' }, width: 4, cap: 'round', vertexWidths, nib },
    };
    const svg = serializeSvg([objToSvgNode(obj)], { namespaces: SWILL_NAMESPACES });
    const parsed = parseSvg(svg, { namespaces: SWILL_NAMESPACES });
    let n = 0;
    const leaves = svgNodesToSceneDrafts(parsed, () => `n${n++}`)
      .filter((d): d is Extract<SceneDraft, { kind: 'mark' }> => d.kind === 'mark');
    expect(leaves).toHaveLength(1);
    const back = leaves[0].obj as PathObj;
    expect(back.tool).toBe('pen');
    expect(back.stroke).toMatchObject({ width: 4, cap: 'round', vertexWidths, nib });
  });
});
