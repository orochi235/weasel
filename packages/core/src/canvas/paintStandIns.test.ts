/** Paint stand-ins: a canvas paints a node a stand-in over it shows through the stand-in's `keep`. */
import { describe, expect, it, vi } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { layersStandingIn, paintStandInsOver, registerPaintStandIn, type KeepPaint } from './paintStandIns';

const withoutPaths: KeepPaint = (cmds) => cmds.filter((c) => c.kind !== 'path');
const kinds = (cmds: readonly DrawCommand[]) => cmds.map((c) => c.kind);

function scene() {
  const s = createScene<{ path: unknown }, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
  s.add({ id: asNodeId('r'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } } } as never);
  return s;
}

describe('registerPaintStandIn', () => {
  it('answers for a canvas of its scene inside its element, while it shows a node', () => {
    const s = scene();
    const within = document.createElement('div');
    const canvas = within.appendChild(document.createElement('canvas'));
    const outside = document.createElement('canvas');
    const standIn = registerPaintStandIn(s, within, withoutPaths);
    expect(paintStandInsOver(canvas, s).size).toBe(0);
    standIn.show('r');
    expect(paintStandInsOver(canvas, s).get('r')).toBe(withoutPaths);
    expect(paintStandInsOver(outside, s).size).toBe(0);
    expect(paintStandInsOver(canvas, scene()).size).toBe(0);
    standIn.dispose();
    expect(paintStandInsOver(canvas, s).size).toBe(0);
  });
});

describe('layersStandingIn', () => {
  const node = scene().get(asNodeId('r'))!;

  it('is the layers given while nothing stands in', () => {
    const layers = { scene: { drawOne: defaultDrawOne } };
    expect(layersStandingIn(layers, new Map())).toBe(layers);
  });

  it("paints a stood-in node through its keep, keeping the default paint bounds", () => {
    const slot = layersStandingIn(undefined, new Map([['r', withoutPaths]]))!.scene as { drawOne: typeof defaultDrawOne; paintBounds: unknown };
    expect(kinds(defaultDrawOne(node, node.pose))).toContain('path');
    expect(kinds(slot.drawOne(node, node.pose))).not.toContain('path');
    expect(slot.paintBounds).toBe(defaultPaintBounds);
  });

  it("wraps a host's drawOne, and leaves a custom layer entry alone", () => {
    const own = vi.fn(() => [{ kind: 'path' } as never]);
    const slot = layersStandingIn({ scene: { drawOne: own } }, new Map([['r', withoutPaths]]))!.scene as { drawOne: typeof defaultDrawOne };
    expect(slot.drawOne(node, node.pose)).toEqual([]);
    const custom = { scene: { layer: {} as never } };
    expect(layersStandingIn(custom as never, new Map([['r', withoutPaths]]))).toBe(custom);
  });
});
