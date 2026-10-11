import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { asPaint, registerPaintKind } from '@weasel-js/core';
import type { SvgNode } from './types';

function gradientOf(svg: string, index = 0): Record<string, unknown> {
  const node = parseSvg(svg).nodes[index] as { fill: { kind: string; paint: Record<string, unknown> } };
  expect(node.fill.kind).toBe('gradient');
  return node.fill.paint;
}

const RECT = '<rect x="0" y="0" width="10" height="10" fill="url(#g)"/>';

describe('gradient collection', () => {
  it('finds a gradient declared outside <defs>', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">`
      + `<linearGradient id="g"><stop offset="0" stop-color="#ff0000"/>`
      + `<stop offset="1" stop-color="#0000ff"/></linearGradient>${RECT}</svg>`,
    );
    expect(r.warnings).toEqual([]);
    const paint = (r.nodes[0] as { fill: { paint: { stops: unknown[] } } }).fill.paint;
    expect(paint.stops).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ]);
  });

  it('reads stop-color and stop-opacity from style="" and from <style> rules', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><style>.end{stop-color:#0000ff}</style>`
      + `<linearGradient id="g"><stop offset="0" stop-color="#000000" style="stop-color:#ff0000;stop-opacity:0.5"/>`
      + `<stop offset="1" class="end"/></linearGradient>${RECT}</svg>`,
    );
    expect(paint.stops).toEqual([
      { offset: 0, color: '#ff000080' },
      { offset: 1, color: '#0000ff' },
    ]);
  });

  it('finds a gradient nested inside a <g>', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><g>`
      + `<linearGradient id="g"><stop offset="0" stop-color="#ff0000"/></linearGradient>`
      + `</g>${RECT}</svg>`,
      1,
    );
    expect(paint.stops).toHaveLength(1);
  });

  it('inherits stops through xlink:href', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs>`
      + `<linearGradient id="base"><stop offset="0" stop-color="#ff0000"/>`
      + `<stop offset="1" stop-color="#0000ff"/></linearGradient>`
      + `<linearGradient id="g" xlink:href="#base" gradientUnits="userSpaceOnUse" `
      + `x1="0" y1="0" x2="10" y2="0"/></defs>${RECT}</svg>`,
    );
    expect(paint.stops).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ]);
    expect(paint.units).toBe('world');
    expect(paint.to).toEqual({ x: 10, y: 0 });
  });

  it('inherits geometry and units through a plain href', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="base" gradientUnits="userSpaceOnUse" x1="1" y1="2" x2="3" y2="4">`
      + `<stop offset="0" stop-color="#ff0000"/></linearGradient>`
      + `<linearGradient id="g" href="#base"/></defs>${RECT}</svg>`,
    );
    expect(paint.units).toBe('world');
    expect(paint.from).toEqual({ x: 1, y: 2 });
    expect(paint.to).toEqual({ x: 3, y: 4 });
  });

  it('survives an href cycle', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="a" href="#g"/><linearGradient id="g" href="#a"/>`
      + `</defs>${RECT}</svg>`,
    );
    expect(paint.stops).toEqual([]);
  });

  it('warns rather than silently mispainting a gradientTransform', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="g" gradientTransform="rotate(45)">`
      + `<stop offset="0" stop-color="#ff0000"/></linearGradient></defs>${RECT}</svg>`,
    );
    expect(r.warnings.join('\n')).toMatch(/gradientTransform/);
  });

  it('reads percentage offsets, stop-opacity and coordinates', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="g" x1="0%" x2="100%">`
      + `<stop offset="50%" stop-color="#ff0000" stop-opacity="50%"/>`
      + `</linearGradient></defs>${RECT}</svg>`,
    );
    expect(paint.to).toEqual({ x: 1, y: 0 });
    expect(paint.stops).toEqual([{ offset: 0.5, color: '#ff000080' }]);
  });

  it('still warns about a <defs> child it cannot model', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="f"/></defs></svg>`,
    );
    expect(r.warnings).toContain('unsupported <defs> child: <filter>');
  });
});

describe('gradient serialization', () => {
  // Conic gradients, which SVG cannot express either, are covered in
  // conic.test.ts; this is the kind the kit knows nothing about.
  function meshRect(): SvgNode[] {
    return [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'gradient', paint: asPaint({ fill: 'mesh-gradient' }) },
    }];
  }

  it('warns about a kind with no vector form of its own', () => {
    const dispose = registerPaintKind({
      id: 'mesh-gradient',
      label: 'Mesh',
      seed: (color) => asPaint({ fill: 'mesh-gradient', color }),
      colorOf: () => undefined,
    });
    try {
      const warnings: string[] = [];
      const svg = serializeSvg(meshRect(), { onWarn: (m) => warnings.push(m) });
      expect(warnings.join(' ')).toContain('mesh-gradient');
      // No def is written, so the reference resolves to nothing — the `none`
      // fallback is what stops that from painting an unpredictable shape.
      expect(svg).toContain('fill="url(#grad0) none"');
    } finally {
      dispose();
    }
  });

  it('says a kind that is not registered may only need loading', () => {
    const warnings: string[] = [];
    serializeSvg([{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
      fill: { kind: 'gradient', paint: asPaint({ fill: 'test-unloaded' }) },
    }], { onWarn: (m) => warnings.push(m) });
    expect(warnings.join(' ')).toMatch(/test-unloaded.*not registered.*warmSvg/);
  });

  it('writes a registered kind\'s own def and a fallback from its color', () => {
    const dispose = registerPaintKind({
      id: 'mesh-gradient',
      label: 'Mesh',
      seed: (color) => asPaint({ fill: 'mesh-gradient', color }),
      colorOf: () => '#c04a3f',
      toSvg: (id) => `<wzl:meshGradient id="${id}"/>`,
    });
    try {
      const warnings: string[] = [];
      const svg = serializeSvg(meshRect(), { onWarn: (m) => warnings.push(m) });
      expect(warnings).toEqual([]);
      expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
      expect(svg).toContain('<wzl:meshGradient id="grad0"/>');
      expect(svg).toContain('fill="url(#grad0) #c04a3f"');
    } finally {
      dispose();
    }
  });
});

describe('fill-opacity on a gradient', () => {
  const SVG = `<svg xmlns="http://www.w3.org/2000/svg">`
    + `<linearGradient id="g"><stop offset="0" stop-color="#ff0000"/>`
    + `<stop offset="1" stop-color="#0000ff"/></linearGradient>`
    + `<rect x="0" y="0" width="10" height="10" fill="url(#g)" fill-opacity="0.5"/></svg>`;

  it('is read onto the gradient paint', () => {
    expect(gradientOf(SVG).opacity).toBe(0.5);
  });

  it('is written back as fill-opacity', () => {
    const out = serializeSvg(parseSvg(SVG).nodes);
    expect(out).toContain('fill-opacity="0.5"');
    expect(gradientOf(out).opacity).toBe(0.5);
  });
});

describe('gradient attributes read to the letter', () => {
  const stops = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
  const doc = (defs: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">${defs}${RECT}</svg>`;

  it('resolves a percentage on a userSpaceOnUse gradient against the viewport', () => {
    const paint = gradientOf(doc(
      `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="10%" x2="100%" y2="50%">${stops}</linearGradient>`,
    ));
    expect(paint).toMatchObject({ from: { x: 20, y: 0 }, to: { x: 200, y: 50 }, units: 'world' });
  });

  it('gives a userSpaceOnUse gradient its percentage defaults', () => {
    // x2 defaults to 100%; cx, cy, and r to 50%, r of sqrt((200² + 100²) / 2) = 158.114.
    const linear = gradientOf(doc(`<linearGradient id="g" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`));
    expect(linear).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 200, y: 0 } });
    const radial = gradientOf(doc(`<radialGradient id="g" gradientUnits="userSpaceOnUse">${stops}</radialGradient>`));
    expect(radial).toMatchObject({ center: { x: 100, y: 50 } });
    expect(radial.radius).toBeCloseTo(79.057, 3);
  });

  it('leaves the defaults alone when there is no viewport', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="g" gradientUnits="userSpaceOnUse">${stops}</linearGradient>${RECT}</svg>`,
    );
    expect(r.warnings).toEqual([]);
    expect((r.nodes[0] as { fill: { paint: unknown } }).fill.paint).toMatchObject({ to: { x: 1, y: 0 } });
  });

  it('still reads a percentage on a bounding-box gradient as a fraction', () => {
    const paint = gradientOf(doc(`<linearGradient id="g" x2="50%">${stops}</linearGradient>`));
    expect(paint).toMatchObject({ to: { x: 0.5, y: 0 }, units: 'bounds' });
  });

  it('multiplies a stop color\'s own alpha by stop-opacity', () => {
    // 0.5 * 0.5 = 0.25, and round(0.25 * 255) = 64 = 0x40.
    const paint = gradientOf(doc(
      '<linearGradient id="g"><stop offset="0" stop-color="rgba(0,0,0,.5)" stop-opacity=".5"/></linearGradient>',
    ));
    expect(paint.stops).toEqual([{ offset: 0, color: '#00000040' }]);
  });

  it('reports a focal point and a spread method it does not model', () => {
    const { warnings } = parseSvg(doc(
      `<radialGradient id="g" fx="0.2" fy="0.2" spreadMethod="reflect">${stops}</radialGradient>`,
    ));
    expect(warnings).toEqual([
      expect.stringMatching(/fx/),
      expect.stringMatching(/spreadMethod="reflect"/),
    ]);
  });

  it('says nothing about spreadMethod="pad"', () => {
    expect(parseSvg(doc(`<linearGradient id="g" spreadMethod="pad">${stops}</linearGradient>`)).warnings).toEqual([]);
  });
});
