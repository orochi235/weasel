import { describe, expect, it } from 'vitest';
import { parseSvg, serializeSvg } from '@weasel-js/svg';
import { solid } from '@weasel-js/core';
import { polygonFromPoints, resolveCorners, withCorner, type PolygonPath } from '@weasel-js/geom';
import { objToSvgNode, svgNodesToSceneDrafts, type SceneDraft } from './svgInterop';
import type { PathObj } from './svgObj';

const NS = { wd: 'https://weaseldraw.app/svg-ext' };

const cornered = (): PolygonPath => withCorner(withCorner(
  polygonFromPoints([{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 60 }, { x: 10, y: 60 }]),
  1, { shape: 'round', radius: 12 }), 3, { shape: 'scoop', radius: 8 });

const obj = (path: PolygonPath): PathObj => ({
  id: 'a', tool: 'pen', x: 10, y: 10, width: 100, height: 50, path,
  fill: { paint: solid('#336699') }, stroke: null,
});

function reopen(svg: string): PathObj {
  const drafts = svgNodesToSceneDrafts(parseSvg(svg, { namespaces: NS }), () => 'x');
  const leaf = drafts.find((d): d is Extract<SceneDraft, { kind: 'mark' }> => d.kind === 'mark')!;
  return leaf.obj as PathObj;
}

describe('corner shapes in a saved file', () => {
  it('write the expanded geometry as the path data', () => {
    const svg = serializeSvg([objToSvgNode(obj(cornered()))], { namespaces: NS });
    // The round corner is a curve in `d`; the bare rectangle has none.
    const d = /<path[^>]* d="([^"]+)"/.exec(svg)![1];
    expect(d).toMatch(/C/);
    expect(svg).toMatch(/wd:corners="1:round:12;3:scoop:8"/);
  });

  it('reopen as the same anchors with the same corners', () => {
    const path = cornered();
    const back = reopen(serializeSvg([objToSvgNode(obj(path))], { namespaces: NS })).path as PolygonPath;
    expect(back.corners).toEqual(path.corners);
    expect([...back.commands]).toEqual([...path.commands]);
    expect([...back.coords]).toEqual([...path.coords]);
    expect([...resolveCorners(back).coords]).toEqual([...resolveCorners(path).coords]);
  });

  it('reopen a numeric superellipse parameter as that number', () => {
    const path = withCorner(cornered(), 2, { shape: -0.75, radius: 10 });
    const svg = serializeSvg([objToSvgNode(obj(path))], { namespaces: NS });
    expect(svg).toMatch(/2:-0\.75:10/);
    expect((reopen(svg).path as PolygonPath).corners?.[2]).toEqual({ shape: -0.75, radius: 10 });
  });

  it('are dropped when the path data no longer matches them', () => {
    const svg = serializeSvg([objToSvgNode(obj(cornered()))], { namespaces: NS })
      .replace(/ d="[^"]+"/, ' d="M0 0L300 0L300 300Z"');
    const back = reopen(svg).path as PolygonPath;
    expect(back.corners).toBeUndefined();
  });
});
