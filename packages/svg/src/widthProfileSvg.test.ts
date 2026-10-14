import { describe, it, expect } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import { parseSvg, serializeSvg } from './index';
import type { SvgPathNode } from './types';

const PROFILE = [{ t: 0, width: 1 }, { t: 1, width: 3 }];

const node = (extra: Partial<SvgPathNode> = {}): SvgPathNode => ({
  kind: 'path',
  path: new PathBuilder().moveTo(0, 0).lineTo(100, 0).build(),
  fill: { kind: 'none' },
  stroke: { paint: { kind: 'solid', color: '#ff0000' }, width: 2, opacity: 0.5, widthProfile: PROFILE },
  ...extra,
});

describe('a stroke with a width profile in SVG', () => {
  it('draws no native stroke and writes its outline filled in the stroke paint', () => {
    const svg = serializeSvg([node()]);
    expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
    const paths = svg.match(/<path [^>]*>/g)!;
    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain('stroke-width="0"');
    expect(paths[0]).toContain('wzl:width-profile="0 1;1 3"');
    expect(paths[1]).toContain('fill="#ff0000"');
    expect(paths[1]).toContain('fill-opacity="0.5"');
    expect(paths[1]).toContain('wzl:role="stroke-outline"');
  });

  it('reads back as one path with its width and profile, the outline dropped', () => {
    const { nodes, warnings } = parseSvg(serializeSvg([node()]));
    expect(warnings).toEqual([]);
    expect(nodes).toHaveLength(1);
    const back = nodes[0] as SvgPathNode;
    expect(back.stroke?.width).toBe(2);
    expect(back.stroke?.widthProfile).toEqual(PROFILE);
  });

  it('keeps a { px } width', () => {
    const svg = serializeSvg([node({ stroke: { paint: { kind: 'solid', color: '#000' }, width: { px: 3 }, widthProfile: PROFILE } })]);
    const back = parseSvg(svg).nodes[0] as SvgPathNode;
    expect(back.stroke?.width).toEqual({ px: 3 });
  });

  it('turns and hides the outline with its path', () => {
    const svg = serializeSvg([node({ rotation: Math.PI / 2, hidden: true })]);
    const paths = svg.match(/<path [^>]*>/g)!;
    expect(paths[1]).toContain('transform="rotate(90');
    expect(paths[1]).toContain('display="none"');
  });

  it('leaves a stroke of one width as SVG draws it', () => {
    const svg = serializeSvg([node({ stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 } })]);
    expect(svg).not.toContain('stroke-outline');
    expect(svg).toContain('stroke-width="2"');
  });
});
