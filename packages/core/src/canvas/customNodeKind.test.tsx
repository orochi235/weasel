/** docs/extending.md's "Custom node kinds" example, written as a consumer writes it, through an insert. */
import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildDepsFromRequires, type BindingOpts, type GestureBinding, type InvocationCtx } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import {
  createScene, defineTool, findNodeShape, insertAction, registerNodeShape, shapeCoversPoint, solid,
  INSERT_DRAG_MODS, INSERT_REPOSITION_BINDING,
  type InsertNodeFactory, type RectPose,
} from '@weasel-js/core';
import { pathFromD, transformPath } from '@weasel-js/geom';
import { useInsertDepSource } from './deps/insert';
import { sceneToAdapter } from './sceneAdapter';

const UNIT_GEM = pathFromD('M50 0 L100 40 L50 100 L0 40 Z'); // in a 100 × 100 box
const gemIn = (p: RectPose) => transformPath(UNIT_GEM, [p.width / 100, 0, 0, p.height / 100, p.x, p.y]);
const isGem = (data: unknown): data is { gem: { color: string } } =>
  typeof data === 'object' && data !== null && 'gem' in data;

const gemFactory: InsertNodeFactory = () => ({ data: { gem: { color: '#3a7bd5' } } });

const gemTool = defineTool({
  id: 'gem',
  keybinding: { key: 'J' },
  capabilities: ['creates-shapes'],
  cursor: 'crosshair',
  presentation: { label: 'Gem', group: 'shape' },
  bindings: [
    { spec: { kind: 'drag', mods: INSERT_DRAG_MODS }, actionId: 'insert', opts: { params: { kind: 'gem' } } },
    INSERT_REPOSITION_BINDING,
  ],
});

let release: (() => void) | undefined;
afterEach(() => release?.());

function drawGem(from: { x: number; y: number }, to: { x: number; y: number }) {
  const scene = createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
  const adapter = sceneToAdapter(scene as never);
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(scene as never, adapter as never, { gem: gemFactory });
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  const binding = (gemTool.def?.bindings ?? [])[0] as GestureBinding;
  const invoker = insertAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const ctx = {
    world: from, screen: from, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: buildDepsFromRequires(insertAction, reg),
  } as unknown as InvocationCtx;
  const handle = invoker.start(ctx, binding.opts as BindingOpts);
  handle.onMove!({ ...ctx, world: to });
  handle.onEnd!({ ...ctx, world: to }, 'commit');
  return [...scene.nodes.values()].find((n) => n.kind === 'mark')!;
}

describe('a custom node kind, as docs/extending.md builds it', () => {
  it('inserts through the tool, paints through its painter, and picks by its outline', () => {
    release = registerNodeShape<unknown, RectPose>({
      id: 'app:gem',
      matches: (node) => isGem(node.data),
      paint: (node, pose) => [{ kind: 'path', path: gemIn(pose), fill: { paint: solid((node.data as { gem: { color: string } }).gem.color) } }],
      silhouette: (_node, pose) => gemIn(pose),
    });
    const node = drawGem({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(node.data).toEqual({ gem: { color: '#3a7bd5' } });
    expect(node.pose).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(findNodeShape(node)?.id).toBe('app:gem');
    expect(shapeCoversPoint(node, node.pose, 50, 50)).toBe(true);
    expect(shapeCoversPoint(node, node.pose, 5, 95)).toBe(false);
  });
});
