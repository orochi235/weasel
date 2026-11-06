import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { HEADER_PAD } from './body';
import { withDiagramRegistry } from './edge';
import { themeWrites, type ThemedScene } from './theme/themeWrites';
import { DIAGRAM_THEMES } from './theme/themes';
import { DEFAULT_NODE_STYLE, diagramScene, type DataNode, type DiagramData } from './fromData';
import { diagramShape } from './shape';
import type { DiagramNode } from './types';

const FONT = { fontFamily: 'sans-serif', fontSize: 10 };
const LINE = 14;
const BAND = LINE + HEADER_PAD * 2;

const NODE: DataNode = {
  id: 'n', at: { x: 0, y: 0 }, padding: 8, gap: 4, verticalAlign: 'top',
  rows: [{ kind: 'header', text: 'Title' }, { kind: 'label', text: 'one' }, { kind: 'label', text: 'two' }],
};
const scene = (node: DataNode, nodeStyle?: () => typeof DEFAULT_NODE_STYLE) =>
  diagramScene({ nodes: [node], edges: [] } satisfies DiagramData, { layout: 'none', font: FONT, ...(nodeStyle ? { nodeStyle } : {}) });
const boxOf = (specs: ReturnType<typeof scene>) => specs.find((s) => s.id === ('n' as never))!;
const textsOf = (specs: ReturnType<typeof scene>) => specs.filter((s) => s.parent === ('n' as never) && typeof s.data?.text === 'string');

describe('a data node with a header', () => {
  it('draws its title left-aligned in the fill color, against the band', () => {
    const [title, row] = textsOf(scene(NODE));
    expect(title!.data).toMatchObject({ text: 'Title', bodyRow: 0, style: { align: 'left' }, fill: { paint: { color: DEFAULT_NODE_STYLE.fill } } });
    expect(row!.data).toMatchObject({ fill: { paint: { color: DEFAULT_NODE_STYLE.text } } });
    expect(title!.pose).toMatchObject({ x: 8, y: HEADER_PAD, height: LINE });
  });

  it('takes its band and title colors from the node style when it names them', () => {
    const specs = scene(NODE, () => ({ ...DEFAULT_NODE_STYLE, header: '#ff0000', headerText: '#00ff00' }));
    expect(boxOf(specs).data?.headerFill).toEqual({ paint: { color: '#ff0000' } });
    expect(textsOf(specs)[0]!.data?.fill).toEqual({ paint: { color: '#00ff00' } });
  });

  it('collapses to its band alone, its other rows unbuilt', () => {
    const open = boxOf(scene(NODE)).pose as { width: number; height: number };
    const specs = scene({ ...NODE, collapsed: true, height: 200 });
    const shut = boxOf(specs).pose as { width: number; height: number };
    expect(shut.height).toBe(BAND);
    expect(shut.width).toBe(open.width);
    expect(textsOf(specs).map((t) => t.data?.text)).toEqual(['Title']);
    expect((boxOf(specs).data?.diagram as DiagramNode).ports).toHaveLength(4);
  });

  it('is drawn whole when collapsed with no header to collapse to', () => {
    const plain: DataNode = { ...NODE, rows: NODE.rows!.slice(1) };
    expect(boxOf(scene({ ...plain, collapsed: true })).pose).toEqual(boxOf(scene(plain)).pose);
  });

  it('is wide enough for a tracked title', () => {
    const wide = (tracking: number) => (boxOf(scene({ ...NODE, rows: [{ kind: 'header', text: 'A long header title', style: { tracking } }] })).pose as { width: number }).width;
    expect(wide(0.5)).toBeCloseTo(wide(0) + 0.5 * FONT.fontSize * 'A long header title'.length);
  });
});

describe('a theme applied to a body with a header', () => {
  it('sets its title in the role\'s fill and its other rows in the role\'s text color', () => {
    const blueprint = DIAGRAM_THEMES.blueprint!;
    const specs = scene(NODE);
    const sc = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: specs as never });
    const writes = themeWrites(sc as unknown as ThemedScene, blueprint) as Map<string, { fill?: { paint: { color: string } } }>;
    const [title, row] = textsOf(specs).map((t) => writes.get(t.id!)?.fill?.paint.color);
    expect(title).toBe(blueprint.roles.default!.fill);
    expect(row).toBe(blueprint.roles.default!.text);
  });
});

type Cmd = { kind: string; path?: unknown; fill?: unknown; stroke?: unknown; clip?: unknown; children?: Cmd[] };

describe('the header band', () => {
  const paint = (specs: ReturnType<typeof scene>) => {
    const box = boxOf(specs);
    return { pose: box.pose as { x: number; y: number; width: number; height: number }, cmds: diagramShape().paint(box as never, box.pose as never) as Cmd[] };
  };

  it('fills between the outline\'s fill and its stroke, clipped to the outline, in the stroke\'s color', () => {
    const { pose, cmds } = paint(scene({ ...NODE, outline: 'roundRect' }));
    expect(cmds.slice(0, 3).map((c) => c.kind)).toEqual(['path', 'group', 'path']);
    expect(cmds[0]).toHaveProperty('fill');
    expect(cmds[0]).not.toHaveProperty('stroke');
    expect(cmds[2]).toHaveProperty('stroke');
    expect(cmds[1]!.clip).toEqual(cmds[0]!.path);
    expect(cmds[1]!.children![0]).toMatchObject({
      path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: BAND },
      fill: { paint: { color: DEFAULT_NODE_STYLE.stroke } },
    });
  });

  it('is not drawn on a body without a header, which keeps one outline command', () => {
    const { cmds } = paint(scene({ ...NODE, rows: NODE.rows!.slice(1) }));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toHaveProperty('fill');
    expect(cmds[0]).toHaveProperty('stroke');
  });
});
