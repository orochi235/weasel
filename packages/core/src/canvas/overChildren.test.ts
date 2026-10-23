import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { buildSceneTree, type HierarchicalAdapter } from './buildSceneTree';
import { defaultDrawOne } from './defaultDrawOne';
import { isOverChildren, overChildren, splitOverChildren } from './overChildren';
import { wrapNodeOutput } from './wrapNodeOutput';
import type { View } from 'core/viewport/view';
import type { Node, RectPose } from 'core/scene/types';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const mark = (name: string): DrawCommand => ({ kind: 'group', children: [], name } as unknown as DrawCommand);
const nameOf = (cmd: DrawCommand): string => (cmd as unknown as { name: string }).name;

interface TestNode { id: string; layer: string; kind: 'group' | 'mark'; parent: string | null }

function adapterOf(nodes: TestNode[]): HierarchicalAdapter<TestNode, RectPose> {
  return {
    getLayers: () => [{ id: 'main', visible: true }],
    getNode: (id) => nodes.find((n) => n.id === id),
    getChildren: (parent) => nodes.filter((n) => n.parent === parent).map((n) => n.id),
    getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
  };
}

/** The names a layer group paints, in order, through every nested group. */
function paintOrder(cmds: DrawCommand[]): string[] {
  return cmds.flatMap((cmd) => {
    const name = nameOf(cmd);
    if (name !== undefined) return [name];
    return cmd.kind === 'group' ? paintOrder((cmd as GroupDrawCommand).children) : [];
  });
}

describe('overChildren', () => {
  it('splits a command list into what goes under a node\'s children and what goes over', () => {
    const a = mark('a'), b = mark('b');
    const { under, over } = splitOverChildren([a, overChildren([b])]);
    expect(under).toEqual([a]);
    expect(over).toEqual([b]);
  });

  it('hands back a list with nothing over as it came', () => {
    const cmds = [mark('a')];
    expect(splitOverChildren(cmds).under).toBe(cmds);
    expect(splitOverChildren(cmds).over).toEqual([]);
  });
});

describe('buildSceneTree with a painter that asks to draw over children', () => {
  const nodes: TestNode[] = [
    { id: 'g', layer: 'main', kind: 'group', parent: null },
    { id: 'c1', layer: 'main', kind: 'mark', parent: 'g' },
    { id: 'c2', layer: 'main', kind: 'mark', parent: 'g' },
    { id: 'after', layer: 'main', kind: 'mark', parent: null },
  ];

  it('paints that part after the node\'s children and before its next sibling', () => {
    const drawOne = (n: TestNode): DrawCommand[] =>
      n.id === 'g' ? [mark('g-under'), overChildren([mark('g-over')])] : [mark(n.id)];
    const tree = buildSceneTree(adapterOf(nodes), drawOne, VIEW);
    expect(paintOrder(tree)).toEqual(['g-under', 'c1', 'c2', 'g-over', 'after']);
  });

  it('adds nothing for a node that asks for nothing over its children', () => {
    const tree = buildSceneTree(adapterOf(nodes), (n) => [mark(n.id)], VIEW);
    expect((tree[0] as GroupDrawCommand).children).toHaveLength(nodes.length);
  });
});

describe('wrapNodeOutput', () => {
  it('turns the part over the children with the pose too, and keeps it over', () => {
    const out = wrapNodeOutput(
      [mark('under'), overChildren([mark('over')])],
      { x: 0, y: 0, width: 10, height: 10, rotation: 1 },
      1,
    );
    const { under, over } = splitOverChildren(out);
    expect(paintOrder(under)).toEqual(['under']);
    expect(paintOrder(over)).toEqual(['over']);
    expect((under[0] as GroupDrawCommand).transform).toBeDefined();
    expect((over[0] as GroupDrawCommand).transform).toEqual((under[0] as GroupDrawCommand).transform);
  });
});

describe('defaultDrawOne', () => {
  const POSE: RectPose = { x: 0, y: 0, width: 100, height: 40 };
  const node = (kind: 'group' | 'mark') => ({
    id: 'n', kind, layer: 'main', parent: null, pose: POSE, data: { label: 'Welcome' },
    ...(kind === 'group' ? { children: [] } : {}),
  }) as unknown as Node<{ label: string }, 'main', RectPose>;

  it('draws a container\'s label over its children', () => {
    const cmds = defaultDrawOne(node('group'), POSE, VIEW);
    expect(cmds.filter(isOverChildren)).toHaveLength(1);
    expect(splitOverChildren(cmds).over.map((c) => c.kind)).toEqual(['text']);
  });

  it('draws a leaf\'s label with the leaf', () => {
    const cmds = defaultDrawOne(node('mark'), POSE, VIEW);
    expect(cmds.some(isOverChildren)).toBe(false);
    expect(cmds.map((c) => c.kind)).toContain('text');
  });
});
