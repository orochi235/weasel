import { describe, it, expect } from 'vitest';
import { defaultDrawOne } from './defaultDrawOne';
import { registerNodeShape } from './NodeShape';
import { solid, strokeOf } from '../util/paint';
import type { Node } from 'core/scene/types';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '../renderer';

// Minimal Node-shaped fixture. The runtime fields the kit actually reads
// from `node.data` are duck-typed inside `defaultDrawOne`; the rest of the
// Node interface is irrelevant to rendering.
function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n',
    kind: 'leaf',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

const POSE = { x: 10, y: 20, width: 80, height: 40 };

describe('defaultDrawOne', () => {
  it('rect fallback: paints data.fill over the pose AABB', () => {
    const cmds = defaultDrawOne(node({ fill: solid('#abc') }), POSE);
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.kind).toBe('path');
    expect(cmd.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd.fill).toEqual({ color: '#abc' });
  });

  it('rect fallback: uses neutral gray when data.fill is missing', () => {
    const cmds = defaultDrawOne(node({}), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.fill).toEqual({ color: '#888' });
  });

  it('adds a top-left label overlay when data.label is present', () => {
    const cmds = defaultDrawOne(node({ fill: solid('#abc'), label: 'Hi' }), POSE);
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
      node({ path, fill: solid('#f00'), stroke: strokeOf('#000', 2) }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd.fill).toEqual({ color: '#f00' });
    expect(cmd.stroke).toEqual({ paint: { color: '#000' }, width: 2 });
  });

  it('path branch: identity-preserves the path when pose already matches the path', () => {
    // No allocation when there is nothing to rebase — the painter returns
    // the path reference unchanged. Guards the fast path against accidental
    // regressions on the common "freshly-created node" case.
    const path = { kind: 'rect' as const, x: 10, y: 20, width: 80, height: 40 };
    const cmds = defaultDrawOne(node({ path, fill: solid('#f00') }), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.path).toBe(path);
  });

  it('path branch: omits stroke when data.stroke is null or missing', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(node({ path, fill: solid('#f00') }), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.stroke).toBeUndefined();

    const cmds2 = defaultDrawOne(
      node({ path, fill: solid('#f00'), stroke: null }),
      POSE,
    );
    const cmd2 = cmds2[0] as PathDrawCommand;
    expect(cmd2.stroke).toBeUndefined();
  });

  it('path branch: includes the label overlay when data.label is present', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(
      node({ path, fill: solid('#f00'), label: 'X' }),
      POSE,
    );
    expect(cmds).toHaveLength(2);
    expect(cmds[1].kind).toBe('text');
  });

  it('text branch: emits a textCommand anchored on the pose box top-left', () => {
    const cmds = defaultDrawOne(
      node({ text: 'Hello', style: { fontFamily: 'sans-serif', fontSize: 20 } }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as TextDrawCommand;
    expect(cmd.kind).toBe('text');
    expect(cmd.x).toBe(10); // POSE.x
    expect(cmd.y).toBe(20); // POSE.y — `y` is the line-box top, not a baseline
  });

  it('text branch: forwards the pose box height but not maxWidth/verticalAlign, and rendering is unchanged', () => {
    // Snapshot-style assertion: the generic kit:text node has no data/style
    // slot for verticalAlign yet, and forwarding maxWidth would newly
    // word-wrap existing consumers' text — neither should be sent. `height`
    // is forwarded (pose already carries it for the box "H" property), but
    // with the default verticalAlign ('top') it resolves to a zero offset,
    // so the emitted command — and thus the pixels — are unchanged.
    const cmds = defaultDrawOne(
      node({ text: 'Hello', style: { fontFamily: 'sans-serif', fontSize: 20 } }),
      POSE,
    );
    const cmd = cmds[0] as TextDrawCommand;
    expect(cmd).toMatchObject({
      kind: 'text',
      x: 10,
      y: 20,
      align: 'left',
      maxWidth: undefined,
      height: POSE.height, // 40 — forwarded, but a no-op with default verticalAlign
      verticalAlign: undefined,
    });
  });

  it('text branch: the anchor does not move with fontSize', () => {
    // The painter once shifted `y` down by the font size, defaulting to 16
    // when the node carried no style. Anchoring on the box top makes the
    // command's origin a property of the *pose*, so a styled and an unstyled
    // node at the same pose start their first line box in the same place —
    // which is what `verticalAlign`'s `[y, y + height]` box assumes.
    const styled = defaultDrawOne(
      node({ text: 'Hello', style: { fontSize: 64 } }), POSE,
    )[0] as TextDrawCommand;
    const unstyled = defaultDrawOne(node({ text: 'Hello' }), POSE)[0] as TextDrawCommand;
    expect(unstyled.y).toBe(POSE.y);
    expect(styled.y).toBe(unstyled.y);
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
      fill: { color: '#abc' },
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
    const cmds = defaultDrawOne(n, POSE, { resolveImage: () => bmp });
    expect(cmds[0]).toMatchObject({ kind: 'image', image: bmp });
  });
});
