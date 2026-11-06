import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { boundsOfPath, pathContainsPoint, pathFromD, type Path } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { createSelectionOverlayLayer } from './overlay';

const RED = { kind: 'solid', color: '#f00' } as const;
const DIMS = { width: 400, height: 400, dpr: 1 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function sceneOf() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const mark = (id: string, data: object, extra: object = {}) => scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'main', data, pose: { x: 0, y: 0, width: 100, height: 60 }, ...extra,
  } as never);
  mark('oval', { shape: 'ellipse' });
  mark('ring', { shape: 'ellipse', stroke: { paint: RED, width: 10 } });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 60 } } as never);
  mark('child', { shape: 'rect' }, { parent: asNodeId('g') });
  mark('wire', { path: pathFromD('M 0 0 L 100 0 L 100 60'), stroke: { paint: RED, width: 4 } });
  mark('bare', { path: pathFromD('M 0 0 L 100 60') });
  mark('labeled', { shape: 'ellipse' });
  mark('label', { text: 'x' }, { parent: asNodeId('labeled'), pickable: false });
  mark('holder', { shape: 'ellipse' });
  mark('member', { shape: 'rect' }, { parent: asNodeId('holder') });
  return scene;
}

function layerFor(scene: ReturnType<typeof sceneOf>, ids: string[], getPose?: (id: string) => RectPose) {
  return createSelectionOverlayLayer<RectPose>({
    getSelection: () => ids.map(asNodeId),
    getPose: getPose ?? ((id) => scene.get(asNodeId(id))!.pose),
    scene,
    handles: false,
    outline: { paint: RED, width: 2, follow: 'shape' },
  });
}

function traced(cmds: readonly DrawCommand[]): PathDrawCommand[] {
  const group = cmds.find((c): c is GroupDrawCommand => c.kind === 'group');
  return (group?.children ?? []) as PathDrawCommand[];
}

describe("selection outline with follow: 'shape'", () => {
  it('strokes the silhouette outward at a fixed screen width, in world space', () => {
    const scene = sceneOf();
    const [cmd] = traced(layerFor(scene, ['oval']).draw(undefined, VIEW, DIMS));
    expect(cmd.path.kind).not.toBe('rect');
    expect(cmd.stroke).toMatchObject({ width: { px: 2 }, align: 'outer' });
    expect(boundsOfPath(cmd.path as Path)).toMatchObject({ x: 0, y: 0, width: 100, height: 60 });
  });

  it("starts outside a stroked node's own stroke", () => {
    const scene = sceneOf();
    const [cmd] = traced(layerFor(scene, ['ring']).draw(undefined, VIEW, DIMS));
    const b = boundsOfPath(cmd.path as Path);
    expect(b.x).toBeCloseTo(-5, 1);
    expect(b.width).toBeCloseTo(110, 1);
  });

  it('reuses the outline across zoom rather than rebuilding it', () => {
    const scene = sceneOf();
    const layer = layerFor(scene, ['ring']);
    const first = traced(layer.draw(undefined, VIEW, DIMS))[0].path;
    const zoomed = traced(layer.draw(undefined, { x: 10, y: 0, scale: { x: 3, y: 3 } }, DIMS))[0].path;
    expect(zoomed).toBe(first);
  });

  it('carries a stroked outline through a move in flight', () => {
    const scene = sceneOf();
    let preview: RectPose | null = null;
    const pose = (id: string) => scene.get(asNodeId(id))!.pose;
    const layer = layerFor(scene, ['ring'], pose);
    const envelope = {
      getEffectivePose: (id: string) => preview ?? pose(id),
      getPreviewSources: () => [{ previewPose: () => preview }],
    };
    layer.draw(envelope, VIEW, DIMS);
    preview = { x: 30, y: 20, width: 100, height: 60 };
    const moved = boundsOfPath(traced(layer.draw(envelope, VIEW, DIMS))[0].path as Path);
    expect(moved.x).toBeCloseTo(25, 1);
    expect(moved.y).toBeCloseTo(15, 1);
  });

  it('keeps the box for a group', () => {
    const scene = sceneOf();
    const cmds = layerFor(scene, ['g']).draw(undefined, VIEW, DIMS);
    expect(traced(cmds)).toHaveLength(0);
    expect((cmds[0] as PathDrawCommand).kind).toBe('path');
  });

  it('traces a shape whose children are all unpickable parts of it, and boxes one holding a member', () => {
    const scene = sceneOf();
    const [cmd] = traced(layerFor(scene, ['labeled']).draw(undefined, VIEW, DIMS));
    expect(cmd!.path.kind).not.toBe('rect');
    expect(traced(layerFor(scene, ['holder']).draw(undefined, VIEW, DIMS))).toHaveLength(0);
  });

  it('traces an open path along the band its stroke covers', () => {
    const scene = sceneOf();
    const edge = traced(layerFor(scene, ['wire']).draw(undefined, VIEW, DIMS))[0].path as Path;
    expect(pathContainsPoint(edge, 50, 1)).toBe(true);
    expect(pathContainsPoint(edge, 99, 30)).toBe(true);
    // Inside the corner the wire turns, where closing it would have filled.
    expect(pathContainsPoint(edge, 70, 20)).toBe(false);
  });

  it('keeps the box for an open path with no stroke', () => {
    const cmds = layerFor(sceneOf(), ['bare']).draw(undefined, VIEW, DIMS);
    expect(traced(cmds)).toHaveLength(0);
  });
});
