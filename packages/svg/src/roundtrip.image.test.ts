import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgImageNode } from './index';
import * as F from './__fixtures__/fixtures';
import { roundTrip, round } from './testing/roundTrip';

describe('round-trip', () => {
  it('<image> (data URI, external URL, xlink:href)', () => {
    const { a, b, warnings } = roundTrip(F.IMAGE_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
    expect(a).toEqual([
      // Group transform collapses onto the box: translate(10 20) scale(2).
      {
        kind: 'group',
        children: [
          { kind: 'image', href: 'data:image/png;base64,iVBORw0KGgo=', x: 20, y: 30, width: 60, height: 40 },
        ],
      },
      {
        kind: 'image', href: 'https://example.com/photo.jpg',
        x: 100, y: 100, width: 80, height: 60,
        opacity: 0.5, rotation: round(Math.PI / 6),
      },
      { kind: 'image', href: 'legacy.png', x: 200, y: 200, width: 40, height: 40 },
    ]);
  });
});

describe('image source rect and flip', () => {
  const VIEW = { viewBox: { x: 0, y: 0, width: 200, height: 200 } };
  const image = (extra: Partial<SvgImageNode> = {}): SvgImageNode => ({
    kind: 'image', href: 'sheet.png', x: 10, y: 20, width: 80, height: 40, ...extra,
  });
  const back = (node: SvgImageNode): { node: SvgImageNode; out: string; warnings: string[] } => {
    const out = serializeSvg([node], VIEW);
    const parsed = parseSvg(out);
    expect(parsed.nodes).toHaveLength(1);
    return { node: parsed.nodes[0] as SvgImageNode, out, warnings: parsed.warnings };
  };

  it('round-trips a source rect', () => {
    const source = { x: 0.25, y: 0.5, width: 0.25, height: 0.5 };
    const { node, warnings } = back(image({ source }));
    expect(warnings).toEqual([]);
    expect(node).toEqual(image({ source }));
  });

  it.each([
    [{ flipX: true }],
    [{ flipY: true }],
    [{ flipX: true, flipY: true }],
  ] as const)('round-trips %o, with and without a source rect', (flips) => {
    expect(back(image(flips)).node).toEqual(image(flips));
    const source = { x: 0.5, y: 0, width: 0.5, height: 0.5 };
    expect(back(image({ ...flips, source })).node).toEqual(image({ ...flips, source }));
  });

  it('round-trips rotation and opacity beside a source rect', () => {
    const node = image({
      source: { x: 0, y: 0, width: 0.5, height: 1 }, flipX: true, rotation: Math.PI / 6, opacity: 0.5,
    });
    const got = back(node).node;
    expect(got.rotation).toBeCloseTo(Math.PI / 6);
    expect({ ...got, rotation: node.rotation }).toEqual(node);
  });

  // What a reader that knows nothing of weasel sees: a viewport at the box
  // whose viewBox is the source window, over a unit-square image mirrored
  // about that window's center.
  it('writes a nested <svg> viewport any SVG reader crops with', () => {
    const { out } = back(image({ source: { x: 0.25, y: 0.5, width: 0.25, height: 0.5 }, flipX: true }));
    expect(out).toContain(
      '<svg x="10" y="20" width="80" height="40" viewBox="0.25 0.5 0.25 0.5" preserveAspectRatio="none">',
    );
    expect(out).toContain(
      '<image href="sheet.png" x="0" y="0" width="1" height="1" preserveAspectRatio="none"'
      + ' transform="matrix(-1 0 0 1 0.75 0)"/>',
    );
  });

  it('writes a plain <image> when there is nothing to crop or flip', () => {
    expect(back(image()).out).not.toContain('<g');
  });
});
