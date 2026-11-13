import { describe, expect, it } from 'vitest';
import {
  boundsOfPath, getMarker, pathFromD, registerMarker, type PolygonPath,
} from '@weasel-js/core';
import { pathLengthTable, pathToD } from '@weasel-js/geom';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgPathNode } from './types';

const INK = { kind: 'solid', color: '#000000' } as const;
const ARC = 'M0 0C40 -60 100 -60 120 0';
const arc = (stroke: SvgPathNode['stroke'], extra: Partial<SvgPathNode> = {}): SvgPathNode => ({
  kind: 'path', path: pathFromD(ARC) as PolygonPath, fill: { kind: 'none' }, stroke, ...extra,
});
const elements = (svg: string) => svg.replace(/<defs>[\s\S]*<\/defs>/, '').match(/<path [^>]*>/g)!;
const attr = (el: string, name: string) => new RegExp(` ${name}="([^"]*)"`).exec(el)?.[1];
const marker = (svg: string, id: string) => new RegExp(`<marker id="${id}"[^>]*>`).exec(svg)?.[0];

describe('svg export seats an inset head on the cut shaft', () => {
  it('cuts the shaft back by the inset and keeps the path as authored', () => {
    const svg = serializeSvg([arc({ paint: INK, width: 4, markerEnd: 'arrow' })]);
    const [el] = elements(svg);
    const authored = pathToD(pathFromD(ARC));
    expect(attr(el, 'wzl:d')).toBe(authored);
    const total = pathLengthTable(pathFromD(ARC)).total;
    expect(pathLengthTable(pathFromD(attr(el, 'd')!)).total).toBeCloseTo(total - 3 * 4, 3);
    expect(svg).toContain('xmlns:wzl=');
  });

  it("moves the seated def's reference point back by the inset, onto the head's back", () => {
    const svg = serializeSvg([arc({ paint: INK, width: 4, markerEnd: 'arrow' })]);
    const def = marker(svg, 'arrow')!;
    expect(attr(def, 'refX')).toBe('-3');
    expect(attr(def, 'wzl:seated')).toBe('true');
  });

  it('gives a mid reference, and an end it cannot cut, the unseated def', () => {
    const svg = serializeSvg([
      arc({ paint: INK, width: 4, markerMid: 'arrow', markerEnd: 'arrow' }),
      { kind: 'path', path: pathFromD('M0 0L5 0') as PolygonPath, fill: { kind: 'none' }, stroke: { paint: INK, width: 4, markerEnd: 'arrow' } },
    ]);
    const [curve, short] = elements(svg);
    expect(attr(curve, 'marker-mid')).toBe('url(#arrow-tip)');
    expect(attr(curve, 'marker-end')).toBe('url(#arrow)');
    expect(attr(short, 'marker-end')).toBe('url(#arrow-tip)');
    expect(attr(short, 'd')).toBe('M0 0L5 0');
    const tip = marker(svg, 'arrow-tip')!;
    expect(attr(tip, 'refX')).toBe('0');
    expect(attr(tip, 'wzl:key')).toBe('arrow');
  });

  it('writes a fill whole, under the cut shaft', () => {
    const [fill, shaft] = elements(serializeSvg([arc({ paint: INK, width: 4, markerEnd: 'arrow' }, { fill: { kind: 'solid', color: '#ff0000' } })]));
    expect(attr(fill, 'd')).toBe(pathToD(pathFromD(ARC)));
    expect(attr(fill, 'stroke')).toBe('none');
    expect(attr(shaft, 'fill')).toBe('none');
    expect(attr(shaft, 'wzl:d')).toBe(attr(fill, 'd'));
  });

  it('reads the authored path and the kit markers back', () => {
    const svg = serializeSvg([arc({ paint: INK, width: 4, markerMid: 'arrow', markerEnd: 'arrow' })]);
    const [node] = parseSvg(svg).nodes as SvgPathNode[];
    expect(pathToD(node.path)).toBe(pathToD(pathFromD(ARC)));
    expect(node.stroke?.markerEnd).toBe('arrow');
    expect(node.stroke?.markerMid).toBe('arrow');
  });

  it("reads a seated def it has no entry for with its tip at the origin and its inset", () => {
    const dispose = registerMarker({
      id: 'seat-probe',
      path: ({ size }) => pathFromD(`M0 0L${-4 * size} ${-size}L${-4 * size} ${size}Z`) as PolygonPath,
      inset: 4,
    });
    const svg = serializeSvg([arc({ paint: INK, width: 2, markerEnd: 'seat-probe' })]);
    dispose();
    const { nodes, markers } = parseSvg(svg);
    const ref = (nodes[0] as SvgPathNode).stroke?.markerEnd as string;
    const entry = markers?.find((m) => m.id === ref) ?? getMarker(ref);
    expect(entry?.inset).toBe(4);
    const b = boundsOfPath(entry!.path({ size: 1, stroke: { paint: INK } }));
    expect(b.x + b.width).toBeCloseTo(0, 6);
    expect(b.x).toBeCloseTo(-4, 6);
  });
});
