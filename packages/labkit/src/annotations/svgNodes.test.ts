import { serializeSvg, svgNeeds } from '@weasel-js/svg';
import { describe, expect, it } from 'vitest';
import { markCommands } from './paint';
import { markSvgNodes } from './svgNodes';
import type { AnnotationData, AnnotationKind } from './types';

const mark = (kind: AnnotationKind, extra: Partial<AnnotationData> = {}) => ({
  pose: { x: 10, y: 12, width: 30, height: 20 },
  data: {
    target: 'flat',
    kind,
    shape: [
      { x: 0.1, y: 0.2 },
      { x: 0.5, y: 0.6 },
    ],
    ...extra,
  } as AnnotationData,
});

const KINDS: AnnotationKind[] = ['rect', 'ellipse', 'line', 'arrow', 'stroke'];

describe('a mark as vector', () => {
  it.each(KINDS)('emits %s off the same geometry the screen draws', (kind) => {
    const m = mark(kind);
    const cmds = markCommands(m);
    const nodes = markSvgNodes(m);
    expect(nodes).toHaveLength(cmds.length);
    for (const [i, cmd] of cmds.entries()) {
      if (cmd.kind !== 'path') throw new Error('expected path commands');
      const node = nodes[i];
      if (node?.kind !== 'path') throw new Error('expected path nodes');
      // Same geometry, kind for kind. A second switch over `data.kind` would
      // drift from this one the moment either changed, which is what the
      // emitter mapping over `markCommands` output rules out.
      expect(node.path).toEqual(cmd.path);
      expect(node.stroke?.width).toBe(cmd.stroke?.width);
      expect(node.stroke?.cap).toBe(cmd.stroke?.cap);
      expect(node.stroke?.join).toBe(cmd.stroke?.join);
      // An arrow's head arrives filled and unstroked; the shaft is the other
      // way round. Whichever paint the command carries is the mark color.
      const paint = node.stroke?.paint ?? node.fill;
      expect(paint).toEqual({ kind: 'solid', color: '#e5484d' });
    }
  });

  it('carries a stale mark′s dash through', () => {
    const [node] = markSvgNodes(mark('rect'), { stale: true });
    if (node?.kind !== 'path') throw new Error('expected a path node');
    expect(node.stroke?.dash).toEqual([6, 4]);
  });

  it("keeps the arrow's marker, so the export draws its head", () => {
    const nodes = markSvgNodes(mark('arrow'));
    expect(nodes).toHaveLength(1);
    const [node] = nodes;
    if (node?.kind !== 'path') throw new Error('expected a path node');
    expect(node.stroke?.markerEnd).toBe('arrow');
    expect(serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 100, height: 60 } })).toContain(
      '<marker',
    );
  });

  it('emits text as text, at the pose, in the mark color', () => {
    const m = mark('text', { title: 'missing edge' });
    const [node] = markSvgNodes(m);
    expect(node).toMatchObject({ kind: 'text', text: 'missing edge', x: 10, y: 12 });
  });

  it('emits nothing for a text mark with no words', () => {
    expect(markSvgNodes(mark('text'))).toEqual([]);
  });

  // Why `composeCaptureSvg` and `<OverviewMarks>` serialize without awaiting
  // `warmSvg`: a mark exports nothing that loads on demand. A mark gaining a
  // gradient paint or a script run fails this, and those two then need it.
  it('needs nothing loaded to serialize, stale or not', () => {
    const all: AnnotationKind[] = [...KINDS, 'point', 'text'];
    for (const stale of [false, true]) {
      const nodes = all.flatMap((k) =>
        markSvgNodes(mark(k, { title: 'words' }), { stale, color: '#123456' }),
      );
      expect(nodes.length).toBeGreaterThan(all.length - 1);
      expect(svgNeeds(nodes)).toEqual({ fonts: [], paintKinds: [] });
    }
  });
});
