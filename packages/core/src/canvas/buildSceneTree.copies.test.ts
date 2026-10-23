import { describe, expect, it } from 'vitest';
import { mat3, multiply, scale, translate, type Affine } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { sceneToAdapter } from './sceneAdapter';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };

const draw = (node: { data: Data }): DrawCommand[] => [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { kind: 'solid', color: node.data.label } } },
];

/** Every painted label with the transform its group chain applies, as an affine. */
function painted(cmds: readonly DrawCommand[]): Array<{ label: string; m: Affine; clips: number }> {
  const out: Array<{ label: string; m: Affine; clips: number }> = [];
  const walk = (c: DrawCommand, m: Affine, clips: number): void => {
    if (c.kind === 'group') {
      const t = c.transform ? multiply(m, mat3.toAffine(c.transform)) : m;
      for (const child of c.children) walk(child, t, clips + (c.clip ? 1 : 0));
    } else if (c.kind === 'path') {
      out.push({ label: (c.fill?.paint as { color: string }).color, m, clips });
    }
  };
  for (const c of cmds) walk(c, [1, 0, 0, 1, 0, 0], 0);
  return out;
}

const close = (a: Affine, b: Affine) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

function sceneWith(copies: readonly Affine[]) {
  const scene = createScene<Data, 'fg', Pose>({ systemLayers: [{ id: 'fg' }] });
  const group = scene.add({
    kind: 'group', layer: 'fg', pose: POSE, data: { label: 'group' },
    copiesFromPose: () => copies,
  });
  return { scene, group };
}

describe('buildSceneTree: a container drawing copies', () => {
  it('draws each child once as authored and once under every copy, on top', () => {
    const shift = translate(100, 0);
    const flip = scale(-1, 1);
    const { scene, group } = sceneWith([shift, flip]);
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'a' }, parent: group });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'b' }, parent: group });
    const out = painted(buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW));
    expect(out.map((p) => p.label)).toEqual(['group', 'a', 'b', 'a', 'b', 'a', 'b']);
    const id: Affine = [1, 0, 0, 1, 0, 0];
    expect(out.slice(0, 3).every((p) => close(p.m, id))).toBe(true);
    expect(close(out[3].m, shift) && close(out[4].m, shift)).toBe(true);
    expect(close(out[5].m, flip) && close(out[6].m, flip)).toBe(true);
  });

  it('does not copy the container\'s own paint', () => {
    const { scene } = sceneWith([translate(5, 5)]);
    const out = painted(buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW));
    expect(out.map((p) => p.label)).toEqual(['group']);
  });

  it('composes nested copies, the outer transform outermost', () => {
    const outer = translate(100, 0);
    const inner = translate(0, 50);
    const { scene, group } = sceneWith([outer]);
    const sub = scene.add({
      kind: 'group', layer: 'fg', pose: POSE, data: { label: 'sub' }, parent: group,
      copiesFromPose: () => [inner],
    });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'a' }, parent: sub });
    const out = painted(buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW))
      .filter((p) => p.label === 'a');
    expect(out).toHaveLength(4);
    const want = [[1, 0, 0, 1, 0, 0], inner, outer, multiply(outer, inner)] as Affine[];
    for (const w of want) expect(out.some((p) => close(p.m, w))).toBe(true);
  });

  it('carries the container\'s clip into each copy, under the copy\'s transform', () => {
    const shift = translate(100, 0);
    const scene = createScene<Data, 'fg', Pose>({ systemLayers: [{ id: 'fg' }] });
    const group = scene.add({
      kind: 'group', layer: 'fg', pose: POSE, data: { label: 'group' },
      clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 5, height: 5 }),
      copiesFromPose: () => [shift],
    });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'a' }, parent: group });
    const tree = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW);
    const copy = painted(tree).filter((p) => p.label === 'a' && close(p.m, shift));
    expect(copy).toHaveLength(1);
    expect(copy[0].clips).toBe(1);
  });

  it('keeps an ancestor clip above the copying container out of the copy\'s transform', () => {
    const shift = translate(100, 0);
    const scene = createScene<Data, 'fg', Pose>({ systemLayers: [{ id: 'fg' }] });
    const frame = scene.add({
      kind: 'group', layer: 'fg', pose: POSE, data: { label: 'frame' },
      clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 50, height: 50 }),
    });
    const group = scene.add({
      kind: 'group', layer: 'fg', pose: POSE, data: { label: 'group' }, parent: frame,
      clipFromPose: () => null,
      copiesFromPose: () => [shift],
    });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'a' }, parent: group });
    const tree = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW);
    // The frame's clip group must enclose the transform, not sit inside it.
    const findCopy = (c: DrawCommand, clipAbove: boolean): boolean => {
      if (c.kind !== 'group') return false;
      if (c.transform) return clipAbove;
      return c.children.some((k) => findCopy(k, clipAbove || c.clip !== undefined));
    };
    expect(tree.some((c) => findCopy(c, false))).toBe(true);
  });

  it('draws no copies when the function answers null', () => {
    const scene = createScene<Data, 'fg', Pose>({ systemLayers: [{ id: 'fg' }] });
    const group = scene.add({
      kind: 'group', layer: 'fg', pose: POSE, data: { label: 'group' }, copiesFromPose: () => null,
    });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'a' }, parent: group });
    const out = painted(buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW));
    expect(out.map((p) => p.label)).toEqual(['group', 'a']);
  });
});
