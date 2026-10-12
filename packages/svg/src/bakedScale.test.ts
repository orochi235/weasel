import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import type { SvgGroupNode, SvgImageNode, SvgNode, SvgPathNode, SvgTextNode } from './types';

const SVG = 'http://www.w3.org/2000/svg';

function firstLeaf<T extends SvgNode>(body: string): { leaf: T; warnings: string[] } {
  const { nodes, warnings } = parseSvg(`<svg xmlns="${SVG}">${body}</svg>`);
  let node = nodes[0];
  while (node.kind === 'group') node = (node as SvgGroupNode).children[0];
  return { leaf: node as T, warnings };
}

describe('lengths under a baked transform', () => {
  it('scales a stroke width and its dashes with the group', () => {
    const { leaf, warnings } = firstLeaf<SvgPathNode>(
      '<g transform="scale(10)"><path d="M0 0h10" stroke="#000" stroke-width="0.5" stroke-dasharray="1 2"/></g>',
    );
    expect(warnings).toEqual([]);
    expect(leaf.stroke?.width).toBe(5);
    expect(leaf.stroke?.dash).toEqual([10, 20]);
  });

  it('scales the default stroke width of 1', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      '<g transform="scale(4)"><path d="M0 0h10" stroke="#000"/></g>',
    );
    expect(leaf.stroke?.width).toBe(4);
  });

  it('leaves a non-scaling stroke at its screen width', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      '<g transform="scale(10)"><path d="M0 0h10" stroke="#000" stroke-width="0.5" '
      + 'stroke-dasharray="1 2" vector-effect="non-scaling-stroke"/></g>',
    );
    expect(leaf.stroke?.width).toEqual({ px: 0.5 });
    expect(leaf.stroke?.dash).toEqual([1, 2]);
  });

  it('scales a stroke by the element\'s own baked transform', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      '<path transform="scale(3)" d="M0 0h10" stroke="#000" stroke-width="2"/>',
    );
    expect(leaf.stroke?.width).toBe(6);
  });

  it('leaves a stroke alone under a rotation kept as a rotation', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      '<rect transform="rotate(30 5 5)" width="10" height="10" stroke="#000" stroke-width="2"/>',
    );
    expect(leaf.rotation).toBeCloseTo(Math.PI / 6, 10);
    expect(leaf.stroke?.width).toBe(2);
  });

  it('takes the uniform part of a non-uniform scale and warns', () => {
    // scale(8 2): sqrt(16) = 4.
    const { leaf, warnings } = firstLeaf<SvgPathNode>(
      '<g transform="scale(8 2)"><path d="M0 0h10" stroke="#000" stroke-width="1"/></g>',
    );
    expect(leaf.stroke?.width).toBe(4);
    expect(warnings).toEqual([expect.stringMatching(/non-uniform scale/)]);
  });

  it('scales a text box, its font size, and its stroke with the group', () => {
    // Own box (1, 2 - 12, 4, 1.5) times 10.
    const { leaf, warnings } = firstLeaf<SvgTextNode>(
      '<g transform="scale(10)"><text x="1" y="2" font-size="12" stroke="#000" stroke-width="0.25" '
      + 'data-weasel-width="4" data-weasel-height="1.5">Hi</text></g>',
    );
    expect(warnings).toEqual([]);
    expect(leaf).toMatchObject({ x: 10, y: -100, width: 40, height: 15 });
    expect(leaf.style?.fontSize).toBe(120);
    expect(leaf.stroke?.width).toBe(2.5);
  });

  it('turns text with a rotated group', () => {
    // Box (0, 0, 40, 10), center (20, 5); rotate(90) takes it to (-5, 20).
    const { leaf, warnings } = firstLeaf<SvgTextNode>(
      '<g transform="rotate(90)"><text x="0" y="10" font-size="10" '
      + 'data-weasel-width="40" data-weasel-height="10">Hi</text></g>',
    );
    expect(warnings).toEqual([]);
    expect(leaf.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(leaf.x).toBeCloseTo(-25, 9);
    expect(leaf.y).toBeCloseTo(15, 9);
  });

  it('turns an image with a rotated group instead of inflating its box', () => {
    const { leaf } = firstLeaf<SvgImageNode>(
      '<g transform="rotate(90)"><image width="40" height="10" href="a.png"/></g>',
    );
    expect(leaf.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(leaf.width).toBeCloseTo(40, 9);
    expect(leaf.height).toBeCloseTo(10, 9);
  });
});

describe('a userSpaceOnUse gradient under a baked transform', () => {
  const defs = '<defs>'
    + '<linearGradient id="lin" gradientUnits="userSpaceOnUse" x1="0" x2="50">'
    + '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>'
    + '<radialGradient id="rad" gradientUnits="userSpaceOnUse" cx="5" cy="6" r="7">'
    + '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></radialGradient>'
    + '<linearGradient id="box" x1="0" x2="1">'
    + '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>'
    + '</defs>';

  it('moves a linear gradient with the translated shape', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      `${defs}<g transform="translate(100,100)"><rect width="50" height="50" fill="url(#lin)"/></g>`,
    );
    expect(leaf.path).toMatchObject({ kind: 'rect', x: 100, y: 100, width: 50, height: 50 });
    expect(leaf.fill).toMatchObject({
      kind: 'gradient',
      paint: { from: { x: 100, y: 100 }, to: { x: 150, y: 100 }, units: 'world' },
    });
  });

  it('moves and scales a radial gradient, on a stroke too', () => {
    // matrix(2 0 0 2 10 20): center (5, 6) to (20, 32), radius 7 to 14.
    const { leaf } = firstLeaf<SvgPathNode>(
      `${defs}<g transform="matrix(2 0 0 2 10 20)"><rect width="50" height="50" fill="url(#rad)" stroke="url(#rad)"/></g>`,
    );
    const want = { kind: 'gradient', paint: { center: { x: 20, y: 32 }, radius: 14 } };
    expect(leaf.fill).toMatchObject(want);
    expect(leaf.stroke?.paint).toMatchObject(want);
  });

  it('leaves an objectBoundingBox gradient alone', () => {
    const { leaf } = firstLeaf<SvgPathNode>(
      `${defs}<g transform="translate(100,100)"><rect width="50" height="50" fill="url(#box)"/></g>`,
    );
    expect(leaf.fill).toMatchObject({
      kind: 'gradient', paint: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, units: 'bounds' },
    });
  });

  it('moves a gradient on text with its box', () => {
    const { leaf } = firstLeaf<SvgTextNode>(
      `${defs}<g transform="translate(100,100)"><text x="0" y="10" font-size="10" fill="url(#lin)">Hi</text></g>`,
    );
    expect(leaf.fill).toMatchObject({ paint: { from: { x: 100, y: 100 }, to: { x: 150, y: 100 } } });
  });
});
