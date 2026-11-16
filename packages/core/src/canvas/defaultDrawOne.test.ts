import { describe, it, expect } from 'vitest';
import { defaultDrawOne } from './defaultDrawOne';
import { registerNodeShape } from './NodeShape';
import { solid, strokeOf } from '@weasel-js/paint';
import type { Node } from 'core/scene/types';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '@weasel-js/renderer';

// Minimal Node-shaped fixture. The runtime fields the kit actually reads
// from `node.data` are duck-typed inside `defaultDrawOne`; the rest of the
// Node interface is irrelevant to rendering.
function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n',
    kind: 'mark',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

const POSE = { x: 10, y: 20, width: 80, height: 40 };

describe('defaultDrawOne', () => {
  it('rect fallback: paints data.fill over the pose AABB', () => {
    const cmds = defaultDrawOne(node({ fill: { paint: solid('#abc') } }), POSE);
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.kind).toBe('path');
    expect(cmd.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd.fill).toEqual({ paint: { color: '#abc' } });
  });

  it('rect fallback: paints no fill when data.fill is missing', () => {
    const cmds = defaultDrawOne(node({}), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.fill).toBeUndefined();
  });

  it('adds a top-left label overlay when data.label is present', () => {
    const cmds = defaultDrawOne(node({ fill: { paint: solid('#abc') }, label: 'Hi' }), POSE);
    expect(cmds).toHaveLength(2);
    const label = cmds[1] as TextDrawCommand;
    expect(label.kind).toBe('text');
    expect(label.x).toBe(16); // POSE.x + 6
    expect(label.y).toBe(34); // POSE.y + 14
  });

  it('path branch: renders data.path with data.fill/stroke, rebased to pose', () => {
    // Path is anchored at (0, 0) with its own size; pose places + sizes the
    // node at (10, 20, 80, 40). The painter rebases the rect onto the pose
    // (origin + dimensions) so move + resize mutations on pose alone render
    // at the right place + size without touching data.path.
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(
      node({ path, fill: { paint: solid('#f00') }, stroke: strokeOf('#000', 2) }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd.fill).toEqual({ paint: { color: '#f00' } });
    expect(cmd.stroke).toEqual({ paint: { color: '#000' }, width: 2 });
  });

  it('path branch: identity-preserves the path when pose already matches the path', () => {
    // No allocation when there is nothing to rebase — the painter returns
    // the path reference unchanged. Guards the fast path against accidental
    // regressions on the common "freshly-created node" case.
    const path = { kind: 'rect' as const, x: 10, y: 20, width: 80, height: 40 };
    const cmds = defaultDrawOne(node({ path, fill: { paint: solid('#f00') } }), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.path).toBe(path);
  });

  it('path branch: omits stroke when data.stroke is null or missing', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(node({ path, fill: { paint: solid('#f00') } }), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.stroke).toBeUndefined();

    const cmds2 = defaultDrawOne(
      node({ path, fill: { paint: solid('#f00') }, stroke: null }),
      POSE,
    );
    const cmd2 = cmds2[0] as PathDrawCommand;
    expect(cmd2.stroke).toBeUndefined();
  });

  it('path branch: includes the label overlay when data.label is present', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(
      node({ path, fill: { paint: solid('#f00') }, label: 'X' }),
      POSE,
    );
    expect(cmds).toHaveLength(2);
    expect(cmds[1].kind).toBe('text');
  });

  it('text branch: does not paint a label overlay (text content is its own label)', () => {
    const cmds = defaultDrawOne(
      node({ text: 'Hi', label: 'IGNORED' }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
  });

  it('does not mutate the array its painter returned', () => {
    // A painter is entitled to return a memoized array — that is the whole
    // point of caching `paint` — and `defaultDrawOne` appending the label
    // overlay in place would grow that array by one command per frame,
    // unboundedly. The label has to be a copy-on-append.
    const cached: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { paint: { color: '#abc' } },
    }];
    const dispose = registerNodeShape(
      { id: 'test:cached-paint', matches: () => true, paint: () => cached },
      { priority: 'high' },
    );
    try {
      const n = node({ label: 'Hi' });
      const first = defaultDrawOne(n, POSE);
      const second = defaultDrawOne(n, POSE);
      expect(cached).toHaveLength(1);
      expect(first).toHaveLength(2);
      expect(second).toHaveLength(2);
    } finally {
      dispose();
    }
  });

  it('threads NodePaintCtx to the painter (image resolver)', () => {
    const bmp = { width: 2, height: 2, close() {} } as unknown as ImageBitmap;
    const n = node({ image: { src: 'x' } });
    const cmds = defaultDrawOne(n, POSE, undefined, { resolveImage: () => bmp });
    expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp });
  });
});
