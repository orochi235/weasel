import { describe, it, expect } from 'vitest';
import { defaultDrawOne } from './SceneCanvas';
import type { Node } from 'core/scene/types';
import type { PathDrawCommand, TextDrawCommand } from '../renderer';

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
  it('rect fallback: paints data.color over the pose AABB', () => {
    const cmds = defaultDrawOne(node({ color: '#abc' }), POSE);
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.kind).toBe('path');
    expect(cmd.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd.fill).toEqual({ color: '#abc' });
  });

  it('rect fallback: uses neutral gray when data.color is missing', () => {
    const cmds = defaultDrawOne(node({}), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.fill).toEqual({ color: '#888' });
  });

  it('adds a top-left label overlay when data.label is present', () => {
    const cmds = defaultDrawOne(node({ color: '#abc', label: 'Hi' }), POSE);
    expect(cmds).toHaveLength(2);
    const label = cmds[1] as TextDrawCommand;
    expect(label.kind).toBe('text');
    expect(label.x).toBe(16); // POSE.x + 6
    expect(label.y).toBe(34); // POSE.y + 14
  });

  it('path branch: renders data.path with data.fill/stroke', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(
      node({ path, fill: '#f00', stroke: '#000', strokeWidth: 2 }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.path).toBe(path);
    expect(cmd.fill).toEqual({ color: '#f00' });
    expect(cmd.stroke).toEqual({ paint: { color: '#000' }, width: 2 });
  });

  it('path branch: omits stroke when strokeWidth is 0 or missing', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(node({ path, fill: '#f00' }), POSE);
    const cmd = cmds[0] as PathDrawCommand;
    expect(cmd.stroke).toBeUndefined();

    const cmds2 = defaultDrawOne(
      node({ path, fill: '#f00', stroke: '#000', strokeWidth: 0 }),
      POSE,
    );
    const cmd2 = cmds2[0] as PathDrawCommand;
    expect(cmd2.stroke).toBeUndefined();
  });

  it('path branch: includes the label overlay when data.label is present', () => {
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const cmds = defaultDrawOne(
      node({ path, fill: '#f00', label: 'X' }),
      POSE,
    );
    expect(cmds).toHaveLength(2);
    expect(cmds[1].kind).toBe('text');
  });

  it('text branch: emits a textCommand with baseline shifted by fontSize', () => {
    const cmds = defaultDrawOne(
      node({ text: 'Hello', style: { fontFamily: 'sans-serif', fontSize: 20 } }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as TextDrawCommand;
    expect(cmd.kind).toBe('text');
    expect(cmd.x).toBe(10); // POSE.x
    expect(cmd.y).toBe(40); // POSE.y + fontSize (20)
  });

  it('text branch: defaults baseline shift to 16px when style is missing', () => {
    const cmds = defaultDrawOne(node({ text: 'Hello' }), POSE);
    const cmd = cmds[0] as TextDrawCommand;
    expect(cmd.y).toBe(36); // POSE.y + 16 (default fontSize)
  });

  it('text branch: does not paint a label overlay (text content is its own label)', () => {
    const cmds = defaultDrawOne(
      node({ text: 'Hi', label: 'IGNORED' }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
  });
});
