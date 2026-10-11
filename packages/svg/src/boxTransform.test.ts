import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgImageNode, SvgNode, SvgTextNode } from './types';

const SVG = 'http://www.w3.org/2000/svg';
const doc = (body: string): string => `<svg xmlns="${SVG}">${body}</svg>`;

function only<T extends SvgNode>(body: string): { node: T; warnings: string[] } {
  const { nodes, warnings } = parseSvg(doc(body));
  expect(nodes).toHaveLength(1);
  return { node: nodes[0] as T, warnings };
}

// A box pinned by `data-weasel-*` so no expectation rests on font measurement:
// font-size 10 puts the top 10 above the baseline `y`.
const BOXED = 'font-size="10" data-weasel-width="40" data-weasel-height="12"';

describe('a <text> element\'s own transform', () => {
  it.each([
    ['translate(100 50)'],
    ['matrix(1 0 0 1 100 50)'],
  ])('moves the box by %s', (transform) => {
    const { node, warnings } = only<SvgTextNode>(
      `<text transform="${transform}" x="0" y="0" ${BOXED}>Hi</text>`,
    );
    expect(warnings).toEqual([]);
    expect(node).toMatchObject({ x: 100, y: 40, width: 40, height: 12 });
    expect(node.rotation).toBeUndefined();
  });

  it('keeps a rotation about the anchor as a rotation about the moved center', () => {
    // Box (20, 90, 40, 12), center (40, 96). Rotating -90deg about (20, 100)
    // takes the offset (20, -4) to (-4, -20): center (16, 80).
    const { node, warnings } = only<SvgTextNode>(
      `<text transform="rotate(-90 20 100)" x="20" y="100" ${BOXED}>Axis</text>`,
    );
    expect(warnings).toEqual([]);
    expect(node.rotation).toBeCloseTo(-Math.PI / 2, 10);
    expect(node.x).toBeCloseTo(-4, 9);
    expect(node.y).toBeCloseTo(74, 9);
    expect(node.width).toBeCloseTo(40, 9);
    expect(node.height).toBeCloseTo(12, 9);
  });

  it('takes a uniform scale into the box and the font size', () => {
    const { node, warnings } = only<SvgTextNode>(
      `<text transform="scale(2)" x="10" y="30" ${BOXED} letter-spacing="1">Hi</text>`,
    );
    expect(warnings).toEqual([]);
    expect(node).toMatchObject({ x: 20, y: 40, width: 80, height: 24 });
    expect(node.style?.fontSize).toBe(20);
    expect(node.style?.letterSpacing).toBe(2);
  });

  it('scales a default font size that the element never states', () => {
    const { node } = only<SvgTextNode>('<text transform="scale(0.5)" x="0" y="16">Hi</text>');
    expect(node.style?.fontSize).toBe(8);
    expect(node.y).toBe(0);
  });

  it('composes with an inherited translate', () => {
    const { node, warnings } = only<SvgTextNode>(
      `<g transform="translate(10 20)"><text transform="translate(5 7)" x="1" y="12" ${BOXED}>Hi</text></g>`,
    );
    const text = (node as unknown as { children: SvgTextNode[] }).children[0];
    expect(warnings).toEqual([]);
    expect(text).toMatchObject({ x: 16, y: 29 });
  });

  it('places the center and warns when the transform skews', () => {
    // Box (0, 0, 40, 12), center (20, 6); skewX(45) adds y to x: (26, 6).
    const { node, warnings } = only<SvgTextNode>(
      `<text transform="skewX(45)" x="0" y="10" ${BOXED}>Hi</text>`,
    );
    expect(warnings).toEqual([expect.stringMatching(/skew or non-uniform scale/)]);
    expect(node.x).toBeCloseTo(6, 9);
    expect(node.y).toBeCloseTo(0, 9);
    expect(node.rotation).toBeUndefined();
  });

  it('takes the uniform part of a non-uniform scale and warns', () => {
    // scale(4 1): sqrt(|det|) = 2. Center (20, 6) maps to (80, 6).
    const { node, warnings } = only<SvgTextNode>(
      `<text transform="scale(4 1)" x="0" y="10" ${BOXED}>Hi</text>`,
    );
    expect(warnings).toEqual([expect.stringMatching(/skew or non-uniform scale/)]);
    expect(node).toMatchObject({ x: 40, y: -6, width: 80, height: 24 });
    expect(node.style?.fontSize).toBe(20);
  });
});

describe('an <image> element\'s own transform', () => {
  it('scales and moves the box', () => {
    const { node, warnings } = only<SvgImageNode>(
      '<image transform="matrix(0.5 0 0 0.5 200 100)" width="400" height="300" href="a.png"/>',
    );
    expect(warnings).toEqual([]);
    expect(node).toMatchObject({ x: 200, y: 100, width: 200, height: 150 });
    expect(node.rotation).toBeUndefined();
  });

  it('stretches the box under a non-uniform scale', () => {
    const { node, warnings } = only<SvgImageNode>(
      '<image transform="scale(2 3)" x="10" y="10" width="4" height="5" href="a.png"/>',
    );
    expect(warnings).toEqual([]);
    expect(node).toMatchObject({ x: 20, y: 30, width: 8, height: 15 });
  });

  it('reads a mirroring scale as a flip', () => {
    const { node, warnings } = only<SvgImageNode>(
      '<image transform="scale(-1 1)" x="10" y="0" width="4" height="5" href="a.png"/>',
    );
    expect(warnings).toEqual([]);
    expect(node).toMatchObject({ x: -14, y: 0, width: 4, height: 5, flipX: true });
    expect(node.flipY).toBeUndefined();
  });

  it('keeps a rotation about a corner', () => {
    // Box (0, 0, 20, 10), center (10, 5). rotate(90) about the origin takes
    // (x, y) to (-y, x): center (-5, 10).
    const { node, warnings } = only<SvgImageNode>(
      '<image transform="rotate(90)" width="20" height="10" href="a.png"/>',
    );
    expect(warnings).toEqual([]);
    expect(node.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(node.x).toBeCloseTo(-15, 9);
    expect(node.y).toBeCloseTo(5, 9);
    expect(node.width).toBeCloseTo(20, 9);
    expect(node.height).toBeCloseTo(10, 9);
  });

  it('warns when a rotation comes with a non-uniform scale', () => {
    const { warnings } = only<SvgImageNode>(
      '<image transform="rotate(30) scale(2 1)" width="20" height="10" href="a.png"/>',
    );
    expect(warnings).toEqual([expect.stringMatching(/skew or non-uniform scale/)]);
  });
});

describe('export then import', () => {
  it('returns a rotated text and a rotated image to the same box', () => {
    const text: SvgTextNode = {
      kind: 'text', x: 30, y: 40, width: 80, height: 24, text: 'Hi',
      style: { fontSize: 20 }, rotation: Math.PI / 6,
    };
    const image: SvgImageNode = {
      kind: 'image', href: 'a.png', x: 5, y: 6, width: 70, height: 20, rotation: -Math.PI / 4,
    };
    const { nodes, warnings } = parseSvg(serializeSvg([text, image]));
    expect(warnings).toEqual([]);
    expect(nodes[0]).toMatchObject({ kind: 'text', x: 30, y: 40, width: 80, height: 24 });
    expect((nodes[0] as SvgTextNode).rotation).toBeCloseTo(Math.PI / 6, 5);
    expect(nodes[1]).toMatchObject({ kind: 'image', x: 5, y: 6, width: 70, height: 20 });
    expect((nodes[1] as SvgImageNode).rotation).toBeCloseTo(-Math.PI / 4, 5);
  });
});
