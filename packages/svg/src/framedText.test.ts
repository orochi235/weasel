import { describe, it, expect } from 'vitest';
import { boundsOfPath } from '@weasel-js/core';
import { solid } from '@weasel-js/paint';
import { svgLeafFromKit, type SvgKitLeafData } from './fromKit';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgPathNode } from './types';
import { svgNodesToKitDrafts } from './unpack';

const BOX = { x: 10, y: 20, width: 160, height: 120 };
const NS = { wd: 'https://example.test/wd' };

const NOTE: SvgKitLeafData = {
  text: 'hello', background: { paint: solid('#fff1a6') }, padding: 12, overflow: 'clip',
  fill: { paint: solid('#202020') }, edge: { width: 1, shade: 0.2 }, shadow: { x: 0, y: 2, blur: 6, alpha: 0.2 },
};

/** `data` written as a leaf, its group tagged `wd:role="note"`, through a file and back. */
function throughFile(data: SvgKitLeafData) {
  const node = svgLeafFromKit(data, BOX)!;
  node.meta = { wd: { attrs: { role: 'note' } } };
  return parseSvg(serializeSvg([node], { namespaces: NS }), { namespaces: NS });
}

describe('svgNodesToKitDrafts on a text node with a background', () => {
  it('reads a text node with a background back as one text leaf, shadow and edge included', () => {
    let id = 0;
    const drafts = svgNodesToKitDrafts(throughFile(NOTE), () => `n${id++}`);
    expect(drafts).toHaveLength(1);
    const [note] = drafts;
    expect(note).toMatchObject({ kind: 'mark', pose: BOX });
    expect(note!.data).toMatchObject({
      text: 'hello', padding: 12, overflow: 'clip',
      background: { paint: { color: '#fff1a6' } },
    });
  });

  it('reads one with no edge, shadow or clip the same way', () => {
    const drafts = svgNodesToKitDrafts(throughFile({ text: 'hi', background: { paint: solid('#c8ecff') }, padding: 4 }), String);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.data).toMatchObject({ text: 'hi', padding: 4, background: { paint: { color: '#c8ecff' } } });
    expect(drafts[0]!.data).not.toHaveProperty('overflow');
  });

  it('hands leaf the text with the group\'s metadata', () => {
    const seen: unknown[] = [];
    svgNodesToKitDrafts(throughFile(NOTE), String, {
      leaf: (_id, draft, source) => { seen.push(source.kind, source.meta?.wd?.attrs?.role); return draft.data; },
    });
    expect(seen).toEqual(['text', 'note']);
  });

  it('marks the group it writes, and reads a marked group of another shape as the group it is', () => {
    expect(serializeSvg([svgLeafFromKit(NOTE, BOX)!])).toContain('data-weasel-text-frame="true"');
    let id = 0;
    const other = parseSvg(serializeSvg([{
      kind: 'group', textFrame: true,
      children: [{ kind: 'path', path: { kind: 'rect', ...BOX }, fill: { kind: 'solid', color: '#ff0000' } }],
    }], { namespaces: NS }), { namespaces: NS });
    expect(svgNodesToKitDrafts(other, () => `m${id++}`).map((d) => d.kind)).toEqual(['group', 'mark']);
  });
});

describe('svgLeafFromKit on a text node with a shadow and an edge', () => {
  const data: SvgKitLeafData = {
    text: 'a', background: { paint: solid('#ffffff') }, edge: { width: 4, shade: 0.2 }, shadow: { x: 4, y: 6, blur: 0, alpha: 0.5 },
  };
  type Parts = { children: [{ children: SvgPathNode[] }, { children: [SvgPathNode, SvgPathNode] }] };

  it('writes the shadow where it falls and the edge inside the box, as the canvas draws them', () => {
    const [shadow, framed] = (svgLeafFromKit(data, BOX) as unknown as Parts).children;
    expect(boundsOfPath(shadow.children[0]!.path)).toMatchObject({ x: 14, y: 26, width: 160, height: 120 });
    expect(framed.children[1].path).toEqual({ kind: 'rect', x: 12, y: 22, width: 156, height: 116 });
  });

  it('turns the shadow about the box center under a rotation', () => {
    const [shadow] = (svgLeafFromKit(data, { ...BOX, rotation: Math.PI / 2 }) as unknown as Parts).children;
    const b = boundsOfPath(shadow.children[0]!.path);
    // The box center is (90, 80); the (4, 6) offset turns to (-6, 4).
    expect(b.x + b.width / 2).toBeCloseTo(84, 4);
    expect(b.y + b.height / 2).toBeCloseTo(84, 4);
  });
});
