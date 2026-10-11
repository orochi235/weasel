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
  it('converts an absolute unit at 96 per inch', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS}><circle r="5mm"/><rect width="1in" height="2cm"/><rect width="72pt" height="6pc"/></svg>`,
    );
    expect(boundsOfPath((nodes[0] as SvgPathNode).path).width).toBeCloseTo((10 * 96) / 25.4, 4);
    expect((nodes[1] as SvgPathNode).path).toMatchObject({ width: 96, height: (2 * 96) / 2.54 });
    expect((nodes[2] as SvgPathNode).path).toMatchObject({ width: 96, height: 96 });
    expect(warnings).toEqual([]);
  });

  it('converts an absolute unit on stroke-width, stroke-dasharray, and font-size', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS}><path d="M0 0h10" stroke="#000" stroke-width="1in" stroke-dasharray="1in 3pt"/>`
      + `<text x="0" y="20" font-size="12pt">Hi</text></svg>`,
    );
    expect((nodes[0] as SvgPathNode).stroke).toMatchObject({ width: 96, dash: [96, 4] });
    expect((nodes[1] as SvgTextNode).style?.fontSize).toBe(16);
    expect(warnings).toEqual([]);
  });

  it('resolves a percentage against a root sized in an absolute unit', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS} width="2in" height="1in"><rect width="50%" height="100%"/></svg>`,
    );
    expect((nodes[0] as SvgPathNode).path).toMatchObject({ width: 96, height: 96 });
    expect(warnings).toEqual([]);
  });

  it('takes px as user units, silently', () => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}><rect width="30px" height="2e1"/></svg>`);
    expect((nodes[0] as SvgPathNode).path).toMatchObject({ width: 30, height: 20 });
    expect(warnings).toEqual([]);
  });
});

describe('a font-relative length', () => {
  const radius = (body: string): number => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}>${body}</svg>`);
    expect(warnings).toEqual([]);
    const leaf = (n: unknown): SvgPathNode => ((n as { children?: unknown[] }).children
      ? leaf((n as { children: unknown[] }).children[0]) : n as SvgPathNode);
    return boundsOfPath(leaf(nodes[0]).path).width / 2;
  };

  it('takes an em against the 16px default', () => {
    expect(radius('<circle r="2em"/>')).toBeCloseTo(32, 6);
  });

  it('takes an em against an inherited font-size', () => {
    expect(radius('<g font-size="10"><circle r="2em"/></g>')).toBeCloseTo(20, 6);
  });

  it('takes an em against the element\'s own font-size', () => {
    expect(radius('<circle r="2em" font-size="5"/>')).toBeCloseTo(10, 6);
    expect(radius('<circle r="2em" style="font-size: 12pt"/>')).toBeCloseTo(32, 6);
  });

  it('resolves a relative font-size against the parent\'s', () => {
    expect(radius('<g font-size="10"><g font-size="2em"><circle r="1em"/></g></g>')).toBeCloseTo(20, 6);
    expect(radius('<g font-size="10"><g font-size="150%"><circle r="1em"/></g></g>')).toBeCloseTo(15, 6);
    expect(radius('<g font-size="10"><g font-size="2ex"><circle r="1em"/></g></g>')).toBeCloseTo(10, 6);
  });

  it('reads the font-size keywords', () => {
    expect(radius('<g font-size="large"><circle r="1em"/></g>')).toBeCloseTo(18, 6);
    expect(radius('<g style="font-size: X-Small"><circle r="1em"/></g>')).toBeCloseTo(10, 6);
    expect(radius('<g font-size="10"><g font-size="larger"><circle r="1em"/></g></g>')).toBeCloseTo(12, 6);
    expect(radius('<g font-size="12"><g font-size="smaller"><circle r="1em"/></g></g>')).toBeCloseTo(10, 6);
  });

  it('gives text a keyword font-size', () => {
    const text = (inner: string): SvgTextNode => {
      const { nodes, warnings } = parseSvg(`<svg ${NS} viewBox="0 0 100 100">${inner}</svg>`);
      expect(warnings).toEqual([]);
      return nodes[0] as SvgTextNode;
    };
    expect(text('<text font-size="x-large">a</text>').style.fontSize).toBe(24);
    const nested = text('<g font-size="10"><text font-size="larger">a</text></g>') as unknown as { children: SvgTextNode[] };
    expect(nested.children[0].style.fontSize).toBeCloseTo(12, 6);
  });

  it('takes an ex as half an em', () => {
    expect(radius('<g font-size="10"><circle r="3ex"/></g>')).toBeCloseTo(15, 6);
  });

  it('converts stroke-width, stroke-dasharray, and letter-spacing', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS} font-size="10"><path d="M0 0h10" stroke="#000" stroke-width="1ex" stroke-dasharray="1em 2ex"/>`
      + `<text x="0" y="20" letter-spacing="0.5em">Hi</text></svg>`,
    );
    expect((nodes[0] as SvgPathNode).stroke).toMatchObject({ width: 5, dash: [10, 10] });
    expect((nodes[1] as SvgTextNode).style?.letterSpacing).toBe(5);
    expect(warnings).toEqual([]);
  });

  it('inherits a stroke-width as the length it computed to where it was set', () => {
    const { nodes } = parseSvg(
      `<svg ${NS}><g font-size="10" stroke="#000" stroke-width="2em"><path d="M0 0h10" font-size="40"/></g></svg>`,
    );
    expect((nodes[0] as { children: SvgPathNode[] }).children[0].stroke).toMatchObject({ width: 20 });
  });

  it('sizes the root in ems of its own font-size', () => {
    expect(parseSvg(`<svg ${NS} width="10em" height="4ex"/>`)).toMatchObject({ width: 160, height: 32, warnings: [] });
    expect(parseSvg(`<svg ${NS} width="10em" font-size="10"/>`)).toMatchObject({ width: 100, warnings: [] });
  });

  it('sizes a text node by a relative font-size, and a run by its ratio', () => {
    const { nodes, warnings } = parseSvg(
      `<svg ${NS}><g font-size="10"><text font-size="2em" x="0" y="20">a<tspan font-size="0.5em" letter-spacing="1em">b</tspan></text></g></svg>`,
    );
    const text = (nodes[0] as { children: SvgTextNode[] }).children[0];
    expect(text.style?.fontSize).toBe(20);
    expect(text.runs?.[1]).toMatchObject({ fontScale: 0.5, letterSpacing: 10 });
    const stroked = parseSvg(
      `<svg ${NS}><text font-size="10" x="0" y="20"><tspan stroke="#000" stroke-width="1em">b</tspan></text></svg>`,
    );
    expect((stroked.nodes[0] as SvgTextNode).runs?.[0].stroke).toMatchObject({ width: 10 });
    expect(warnings).toEqual([]);
  });

  it('reads a unit it cannot convert as its number and reports it', () => {
    const { nodes, warnings } = parseSvg(`<svg ${NS}><circle r="5vw"/></svg>`);
    expect(boundsOfPath((nodes[0] as SvgPathNode).path).width).toBeCloseTo(10, 6);
    expect(warnings).toEqual(['<circle r="5vw"> unit "vw" is not converted; read as 5']);
  });
});
