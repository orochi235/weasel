import { serializeSvg } from '@weasel-js/svg';
import { describe, expect, it } from 'vitest';
import { markCommands } from './paint';
import { markSvgNodes } from './svgNodes';
import type { AnnotationData, AnnotationKind } from './types';

const CONTENT = { w: 100, h: 60 };

const mark = (kind: AnnotationKind, extra: Partial<AnnotationData> = {}) => ({
  pose: { x: 10, y: 12, width: 30, height: 20 },
  data: {
    target: 'flat',
    kind,
    points: [
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
    const cmds = markCommands(m, CONTENT);
    const nodes = markSvgNodes(m, CONTENT);
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
      // way round. Whichever paint the command carries is the mark colour.
      const paint = node.stroke?.paint ?? node.fill;
      expect(paint).toEqual({ kind: 'solid', color: '#e5484d' });
    }
  });

  it('carries a stale mark′s dash through', () => {
    const [node] = markSvgNodes(mark('rect'), CONTENT, { stale: true });
    if (node?.kind !== 'path') throw new Error('expected a path node');
    expect(node.stroke?.dash).toEqual([6, 4]);
  });

  it("drops the arrow's marker reference, because its head is already a node", () => {
    const nodes = markSvgNodes(mark('arrow'), CONTENT);
    expect(nodes.length).toBeGreaterThan(1);
    for (const node of nodes) {
      if (node.kind !== 'path') throw new Error('expected path nodes');
      // Keeping `markerEnd` would make the serializer emit a <marker> def as
      // well, and the head would be drawn twice.
      expect(node.stroke?.markerEnd).toBeUndefined();
    }
    expect(serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 100, height: 60 } })).not.toContain(
      '<marker',
    );
  });

  it('emits text as text, at the pose, in the mark colour', () => {
    const m = mark('text', { title: 'missing edge' });
    const [node] = markSvgNodes(m, CONTENT);
    expect(node).toMatchObject({ kind: 'text', text: 'missing edge', x: 10, y: 12 });
  });

  it('emits nothing for a text mark with no words', () => {
    expect(markSvgNodes(mark('text'), CONTENT)).toEqual([]);
  });
});
