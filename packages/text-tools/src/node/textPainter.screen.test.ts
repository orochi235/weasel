import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { textLineBoxes } from '@weasel-js/text';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { Path } from '@weasel-js/geom';
import { renderHook } from '@testing-library/react';
import type { Dispatcher, OngoingHandle } from '@weasel-js/routing';
import { textPoseOf, type TextNodeData } from './textPainter';
import { asNodeId, AUTO_POSE_DESCRIPTOR, buildSceneViewCommands, createScene, defaultDrawOne, drawnBoundsOf, findNodeShape, findShapeSilhouette, shapeCoversPoint, type SceneNode as Node, type RectPose } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { hitTestRect } from 'canvas/deps/hitTestArea';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { scenePointQuery } from 'canvas/SceneCanvas/scenePointQuery';
import { usePreviewGhostLayer } from 'canvas/SceneCanvas/usePreviewGhostLayer';
import { withTextPainter } from '../testing/textPainter';

const RED = { kind: 'solid', color: '#f00' } as const;
const POSE: RectPose = { x: 0, y: 0, width: 400, height: 200 };
const PX = { fontFamily: 'inter', fontSize: { px: 20 } };

beforeEach(async () => {
  _resetShapePaintersForTests();
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })) });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  _resetLayoutCacheForTests();
});
withTextPainter();

function node(data: TextNodeData, pose: RectPose = POSE): Node<unknown, 'main', RectPose> {
  return { id: asNodeId('t'), kind: 'mark', layer: 'main', pose, data, parent: null } as Node<unknown, 'main', RectPose>;
}

const textOf = (cmds: DrawCommand[]) => cmds.find((c) => c.kind === 'text') as Extract<DrawCommand, { kind: 'text' }>;

describe('kit:text — a { px } font size', () => {
  it('paints at the view scale the paint ctx carries', () => {
    const n = node({ text: 'AB', style: PX });
    expect(textOf(findNodeShape(n)!.paint(n, POSE, { scale: 2 })).runs[0]!.fontSize).toBe(10);
    expect(textOf(findNodeShape(n)!.paint(n, POSE, { scale: 4 })).runs[0]!.fontSize).toBe(5);
  });

  it('keeps its memo while the scale holds, and a world size keeps it at any scale', () => {
    const px = node({ text: 'AB', style: PX });
    const painter = findNodeShape(px)!;
    expect(painter.paint(px, POSE, { scale: 2 })).toBe(painter.paint(px, POSE, { scale: 2 }));
    const world = node({ text: 'AB', style: { fontFamily: 'inter', fontSize: 20 } });
    expect(painter.paint(world, POSE, { scale: 2 })).toBe(painter.paint(world, POSE, { scale: 4 }));
  });

  it('is sized by the view defaultDrawOne paints at', () => {
    const n = node({ text: 'AB', style: PX });
    const cmds = defaultDrawOne(n, POSE, { x: 0, y: 0, scale: { x: 2, y: 2 } });
    expect(textOf(cmds).runs[0]!.fontSize).toBe(10);
  });

  it('is sized by the view defaultDrawOne paints at when the caller\'s ctx states no density', () => {
    const n = node({ text: 'AB', style: PX });
    const cmds = defaultDrawOne(n, POSE, { x: 0, y: 0, scale: { x: 2, y: 2 } }, {});
    expect(textOf(cmds).runs[0]!.fontSize).toBe(10);
  });

  it('reports the line boxes it draws as its silhouette', () => {
    const data = { text: 'AB', style: PX };
    const at2 = findShapeSilhouette(node(data), POSE, { scale: 2 });
    const [line] = textLineBoxes(textPoseOf(data, POSE), { scale: 2 });
    expect(at2).toMatchObject({ kind: 'polygon' });
    const coords = (at2 as { coords: Float32Array }).coords;
    expect(coords[2]).toBeCloseTo(line!.x + line!.width);
    expect(findShapeSilhouette(node(data), POSE, { scale: 1 })).not.toEqual(at2);
  });

  it('is picked where its lines are at the view scale', () => {
    const data = { text: 'AB', style: PX };
    const [full] = textLineBoxes(textPoseOf(data, POSE));
    const x = full!.width * 0.75;
    const y = full!.height * 0.25;
    expect(shapeCoversPoint(node(data), POSE, x, y, { scale: 1 })).toBe(true);
    expect(shapeCoversPoint(node(data), POSE, x, y, { scale: 2 })).toBe(false);
  });

  it('is taken by a marquee where its lines are at the asking view\'s scale', () => {
    const data = { text: 'AB', style: PX };
    const [full] = textLineBoxes(textPoseOf(data, POSE));
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', data, pose: POSE });
    const box = { x: full!.width * 0.7, y: full!.height * 0.2, width: full!.width * 0.1, height: full!.height * 0.1 };
    const at = (s: number) => hitTestRect(scene, box, { camera: { x: 0, y: 0, scale: { x: s, y: s } } });
    expect(at(1)).toEqual([asNodeId('t')]);
    expect(at(2)).toEqual([]);
  });

  it('bounds a stroked line by its width at the view scale', () => {
    const data = { text: 'AB', style: PX, stroke: { paint: RED, width: 10 } };
    const [line] = textLineBoxes(textPoseOf(data, POSE));
    const tight = { x: 0, y: 0, width: line!.width, height: 200 };
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', data, pose: tight });
    // At scale 2 the line is half as wide, so it no longer reaches the right edge.
    expect(drawnBoundsOf(scene, asNodeId('t'), tight, { scale: 2 }))
      .toEqual({ x: -5, y: -5, width: line!.width + 5, height: 205 });
  });
});

describe('kit:text — a { px } font size, clipping its children', () => {
  const data = { text: 'AB', style: PX };
  // Inside the world-size line box, outside the one drawn at scale 2.
  const inWorldOnly = () => {
    const [full] = textLineBoxes(textPoseOf(data, POSE));
    return { x: full!.width * 0.75, y: full!.height * 0.25, width: full!.width, height: full!.height };
  };
  function clipScene() {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const t = scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', data, pose: POSE, clip: 'outline' });
    scene.add({ id: asNodeId('c'), kind: 'mark', layer: 'main', parent: t, data: {}, pose: POSE });
    return scene;
  }
  const at = (s: number) => ({ x: 0, y: 0, scale: { x: s, y: s } });
  const silhouetteAt = (s: number) => findShapeSilhouette(node(data), POSE, { scale: s });
  const clipsOf = (cmds: DrawCommand[]): Path[] => {
    const out: Path[] = [];
    const visit = (c: DrawCommand): void => {
      if (c.kind !== 'group') return;
      const g = c as GroupDrawCommand;
      if (g.clip) out.push(g.clip as Path);
      g.children.forEach(visit);
    };
    cmds.forEach(visit);
    return out;
  };

  it('clips them to the outline it draws at the view scale, and follows a zoom', () => {
    const scene = clipScene();
    for (const s of [2, 1, 2]) {
      const clips = clipsOf(buildSceneViewCommands(scene, at(s), defaultDrawOne));
      expect(clips).toHaveLength(1);
      expect(clips[0]).toEqual(silhouetteAt(s));
    }
    expect(silhouetteAt(2)).not.toEqual(silhouetteAt(1));
  });

  it('keeps a world-size outline\'s clip through a zoom', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const t = scene.add({ kind: 'mark', layer: 'main', data: { text: 'AB', style: { fontFamily: 'inter', fontSize: 20 } }, pose: POSE, clip: 'outline' });
    scene.add({ kind: 'mark', layer: 'main', parent: t, data: {}, pose: POSE });
    const [first] = clipsOf(buildSceneViewCommands(scene, at(2), defaultDrawOne));
    expect(clipsOf(buildSceneViewCommands(scene, at(4), defaultDrawOne))[0]).toBe(first);
  });

  it('lets a point reach a child only inside the outline drawn at the view scale', () => {
    const scene = clipScene();
    const { x, y } = inWorldOnly();
    const pick = (s: number) => pickWalk(scenePickSource(scene), scenePointQuery<RectPose>(AUTO_POSE_DESCRIPTOR, true, 0)(x, y, { x: s, y: s }));
    expect(pick(1)).toContain('c');
    expect(pick(2)).not.toContain('c');
  });

  it('lets a marquee take a child only inside the outline drawn at the asking view\'s scale', () => {
    const scene = clipScene();
    const { x, y, width: w, height: h } = inWorldOnly();
    const box = { x, y, width: w * 0.05, height: h * 0.1 };
    expect(hitTestRect(scene, box, { camera: at(1) })).toContain(asNodeId('c'));
    expect(hitTestRect(scene, box, { camera: at(2) })).not.toContain(asNodeId('c'));
  });

  it('clips them in a gesture preview to the outline drawn at the view scale', () => {
    const scene = clipScene();
    const handle: OngoingHandle = { previewIds: () => [asNodeId('t'), asNodeId('c')], previewPose: () => null };
    const dispatcher = { inFlight: () => new Map([['g', handle]]), subscribe: () => () => {}, getVersion: () => 0 } as unknown as Dispatcher;
    const { result } = renderHook(() => usePreviewGhostLayer<unknown, 'main', RectPose>({ scene, sceneSlot: { drawOne: defaultDrawOne }, dispatcher }));
    const envelope = { getPreviewSources: () => [handle] };
    expect(clipsOf(result.current.draw(envelope, at(2), { width: 800, height: 600, dpr: 1 }))).toEqual([silhouetteAt(2)]);
  });
});
