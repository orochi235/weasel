import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import { parseSvg } from './parse';
import type { SvgImageNode, SvgPathNode, SvgTextNode } from './types';

const NS = 'xmlns="http://www.w3.org/2000/svg"';

describe('a percentage length on a shape, image, or text', () => {
  it('sizes a 100% background rect to the viewBox', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS} viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#fff"/></svg>`,
    );
    expect(warnings).toEqual([]);
    expect((nodes[0] as SvgPathNode).path).toEqual({ kind: 'rect', x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('falls back to the root width and height with no viewBox', () => {
    const { nodes } = parseSvg(
      `<svg ${NS} width="800" height="600"><rect x="25%" y="50%" width="50%" height="10%"/></svg>`,
    );
    expect((nodes[0] as SvgPathNode).path).toEqual({ kind: 'rect', x: 200, y: 300, width: 400, height: 60 });
  });

  it('takes a radius against the normalized diagonal', () => {
    // sqrt((300² + 400²) / 2) = 353.5534; 10% of it is 35.35534.
    const { nodes } = parseSvg(
      `<svg ${NS} viewBox="0 0 300 400"><circle cx="50%" cy="50%" r="10%"/></svg>`,
    );
    const b = boundsOfPath((nodes[0] as SvgPathNode).path);
    expect(b.x).toBeCloseTo(150 - 35.35534, 3);
    expect(b.y).toBeCloseTo(200 - 35.35534, 3);
    expect(b.width).toBeCloseTo(70.71068, 3);
  });

  it('resolves against the nearest nested svg', () => {
    const { nodes } = parseSvg(
      `<svg ${NS} viewBox="0 0 1000 1000"><svg width="200" height="100"><rect width="50%" height="50%"/></svg></svg>`,
    );
    expect((nodes[0] as SvgPathNode).path).toMatchObject({ width: 100, height: 50 });
  });

  it('reads image and text positions the same way', () => {
    const { nodes } = parseSvg(
      `<svg ${NS} viewBox="0 0 200 100"><image x="10%" y="10%" width="50%" height="50%" href="a.png"/>`
      + '<text x="50%" y="100%" font-size="10" data-weasel-width="40" data-weasel-height="12">a</text></svg>',
    );
    expect(nodes[0] as SvgImageNode).toMatchObject({ x: 20, y: 10, width: 100, height: 50 });
    expect(nodes[1] as SvgTextNode).toMatchObject({ x: 100, y: 90 });
  });

  it('warns and reads the number when there is no viewport', () => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}><rect width="100%" height="20"/></svg>`);
    expect((nodes[0] as SvgPathNode).path).toMatchObject({ width: 100, height: 20 });
    expect(warnings).toEqual([expect.stringMatching(/width="100%".*no viewport/)]);
  });
});

describe('a CSS unit on a geometry attribute', () => {
  it('is read as its number and reported', () => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}><circle r="5mm"/></svg>`);
    expect(boundsOfPath((nodes[0] as SvgPathNode).path).width).toBeCloseTo(10, 6);
    expect(warnings).toEqual(['<circle r="5mm"> unit "mm" is not converted; read as 5']);
  });

  it('takes px as user units, silently', () => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}><rect width="30px" height="2e1"/></svg>`);
    expect((nodes[0] as SvgPathNode).path).toMatchObject({ width: 30, height: 20 });
    expect(warnings).toEqual([]);
  });
});
