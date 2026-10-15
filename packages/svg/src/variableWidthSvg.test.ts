import { describe, it, expect } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import { parseSvg, serializeSvg } from './index';
import type { SvgPathNode } from './types';

const WIDTHS = [2, 6];
const NIB = { angle: 0.5, ratio: 0.25 };

const node = (extra: Partial<SvgPathNode> = {}): SvgPathNode => ({
  kind: 'path',
  path: new PathBuilder().moveTo(0, 0).lineTo(100, 0).build(),
  fill: { kind: 'none' },
  stroke: { paint: { kind: 'solid', color: '#ff0000' }, width: 2, opacity: 0.5, vertexWidths: WIDTHS },
  ...extra,
});

describe('a variable-width stroke in SVG', () => {
  it('draws no native stroke and writes its outline filled in the stroke paint', () => {
    const svg = serializeSvg([node()]);
    expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
    const paths = svg.match(/<path [^>]*>/g)!;
    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain('stroke-width="0"');
    expect(paths[0]).toContain('wzl:vertex-widths="2 6"');
    expect(paths[0]).toContain('wzl:stroke-width="2"');
    expect(paths[1]).toContain('fill="#ff0000"');
    expect(paths[1]).toContain('fill-opacity="0.5"');
    expect(paths[1]).toContain('wzl:role="stroke-outline"');
  });

  it('reads back as one path with its widths, the outline dropped', () => {
    const { nodes, warnings } = parseSvg(serializeSvg([node()]));
    expect(warnings).toEqual([]);
    expect(nodes).toHaveLength(1);
    const back = nodes[0] as SvgPathNode;
    expect(back.stroke?.width).toBe(2);
    expect(back.stroke?.vertexWidths).toEqual(WIDTHS);
  });

  it('keeps a { px } width', () => {
    const svg = serializeSvg([node({ stroke: { paint: { kind: 'solid', color: '#000' }, width: { px: 3 }, vertexWidths: WIDTHS } })]);
    const back = parseSvg(svg).nodes[0] as SvgPathNode;
    expect(back.stroke?.width).toEqual({ px: 3 });
  });

  it('turns and hides the outline with its path', () => {
    const svg = serializeSvg([node({ rotation: Math.PI / 2, hidden: true })]);
    const paths = svg.match(/<path [^>]*>/g)!;
    expect(paths[1]).toContain('transform="rotate(90');
    expect(paths[1]).toContain('display="none"');
  });

  it('puts a node opacity once, on a group holding the path and its outline', () => {
    const svg = serializeSvg([node({ opacity: 0.4 })]);
    expect(svg.match(/opacity="0.4"/g)).toHaveLength(1);
    expect(svg).toMatch(/<g opacity="0.4" wzl:role="stroke-group"><path [^>]*\/><path [^>]*stroke-outline"\/><\/g>/);
    const { nodes } = parseSvg(svg);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ kind: 'path', opacity: 0.4 });
    expect((nodes[0] as SvgPathNode).stroke?.vertexWidths).toEqual(WIDTHS);
  });

  it('draws a marker on the outline only, and reads it back onto the stroke', () => {
    const stroke = { paint: { kind: 'solid' as const, color: '#000' }, width: 2, vertexWidths: WIDTHS };
    const sized = serializeSvg([node({ stroke: { ...stroke, markerEnd: { key: 'arrow', size: 6 } } })]);
    const plain = serializeSvg([node({ stroke: { ...stroke, markerEnd: 'arrow' } })]);
    for (const out of [sized, plain]) {
      const body = out.replace(/<defs>[\s\S]*<\/defs>/, '');
      const paths = body.match(/<path [^>]*>/g)!;
      expect(paths.filter((p) => / marker-end=/.test(p))).toHaveLength(0);
      expect(paths[0]).toContain('wzl:marker-end="url(#');
    }
    const back = parseSvg(plain).nodes[0] as SvgPathNode;
    expect(back.stroke?.markerEnd).toBe('arrow');
  });

  it('draws the marker head into the outline', () => {
    const stroke = { paint: { kind: 'solid' as const, color: '#000' }, width: 2, vertexWidths: WIDTHS };
    const outlineOf = (svg: string) => svg.match(/<path d="([^"]*)"[^>]*stroke-outline/)![1];
    const bare = outlineOf(serializeSvg([node({ stroke })]));
    const headed = outlineOf(serializeSvg([node({ stroke: { ...stroke, markerEnd: 'arrow' } })]));
    expect(headed).not.toBe(bare);
  });

  it('writes a nib, and a per-vertex width left to the stroke width, and reads them back', () => {
    const svg = serializeSvg([node({ stroke: { paint: { kind: 'solid', color: '#000' }, width: 3, nib: NIB, vertexWidths: [4, NaN] } })]);
    expect(svg).toContain('wzl:nib="0.5 0.25"');
    expect(svg).toContain('wzl:vertex-widths="4 -"');
    const back = parseSvg(svg).nodes[0] as SvgPathNode;
    expect(back.stroke?.nib).toEqual(NIB);
    expect(back.stroke?.vertexWidths).toEqual([4, NaN]);
  });

  it('scales per-vertex widths with a transform the parser bakes in', () => {
    const svg = serializeSvg([node()]).replace('<path ', '<g transform="scale(2)"><path ').replace('</svg>', '</g></svg>');
    const back = parseSvg(svg).nodes[0];
    const path = (back.kind === 'group' ? back.children[0] : back) as SvgPathNode;
    expect(path.stroke?.vertexWidths).toEqual([4, 12]);
  });

  it('leaves a stroke of one width as SVG draws it', () => {
    const svg = serializeSvg([node({ stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 } })]);
    expect(svg).not.toContain('stroke-outline');
    expect(svg).toContain('stroke-width="2"');
  });
});
