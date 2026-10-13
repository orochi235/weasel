import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg } from './index';
import * as F from './__fixtures__/fixtures';
import { roundTrip, type NormalizedGroup } from './testing/roundTrip';

describe('round-trip', () => {
  it('nested SVG <g> with transforms', () => {
    const { a, b } = roundTrip(F.NESTED_GROUPS_SVG);
    expect(b).toEqual(a);
  });

  it('a clipped group, under a transform', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
      + `<clipPath id="c"><rect x="10" y="10" width="30" height="20"/></clipPath>`
      + `<g transform="translate(5 7)" clip-path="url(#c)">`
      + `<rect x="0" y="0" width="50" height="50" fill="#123456"/>`
      + `</g></svg>`;
    const { a, b, warnings } = roundTrip(svg);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
    // The group's transform is collapsed onto its children, so the clip is
    // baked into the same space they land in: (10,10) shifted by (5,7).
    const group = a[0] as NormalizedGroup;
    expect(group.clip?.coords.slice(0, 2)).toEqual([15, 17]);
  });

  it('serializes a clip as a <clipPath> def the group references', () => {
    const out = serializeSvg([
      {
        kind: 'group',
        clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
        children: [],
      },
    ]);
    expect(out).toContain('<clipPath id="clip0">');
    expect(out).toContain('clip-path="url(#clip0)"');
  });

  it('groups with wd:group-id round-trip', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.WEASELDRAW_GROUPS_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(2);
    expect(first.nodes[0].kind).toBe('group');
    const g0 = first.nodes[0];
    if (g0.kind !== 'group') throw new Error('expected group');
    expect(g0.meta?.wd?.attrs?.['group-id']).toBe('g1');
    expect(g0.children).toHaveLength(3);

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 400, height: 400 },
      namespaces,
    });
    expect(out).toContain('wd:group-id="g1"');
    expect(out).toContain('wd:group-id="g2"');

    const second = parseSvg(out, { namespaces });
    expect(second.nodes).toHaveLength(2);
    const s0 = second.nodes[0];
    if (s0.kind !== 'group') throw new Error('expected group');
    expect(s0.meta?.wd?.attrs?.['group-id']).toBe('g1');
    expect(s0.children).toHaveLength(3);
  });
});
