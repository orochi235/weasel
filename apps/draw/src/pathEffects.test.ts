/**
 * A WeaselDraw document holding a live blend, through the session save and a
 * reload: the scene `App` builds, `toJSON` as `useSessionPersistence` writes
 * it, and `nodeSpecsFromSnapshot` as `loadInitial` reads it back.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { pathFromD } from '@weasel-js/geom';
import { loadTextOutlines } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import {
  asNodeId, createScene, derivedDepOf, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathEffectParts, rectPath,
  type AddNodeSpec, type NodeId, type SerializedScene, solid,
  layoutPages,
} from '@weasel-js/core';
import { DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { serializeReplacer } from '@editor/index';
import { nodeSpecsFromSnapshot, reviveSnapshot } from './persistence';
import { importSvgText, openSvgText } from './openSvg';
import { sceneToSvgString, selectionToSvgString } from './svgExport';

type Spec = AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

const box = (id: string, x: number, color: string): Spec => ({
  kind: 'mark',
  id: asNodeId(id),
  layer: 'default',
  pose: { x, y: 0, width: 40, height: 40 },
  data: { path: rectPath(0, 0, 40, 40), fill: { paint: solid(color) } },
});

const drawScene = (initial: Spec[]) =>
  createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    registry: DRAW_REGISTRY,
    initial,
  });

function steps(scene: ReturnType<typeof drawScene>) {
  const blend = scene.get(asNodeId('blend'))!;
  const deps = (blend.dependsOn as NodeId[]).map((id) => derivedDepOf(scene, id));
  return pathEffectParts(blend, deps) ?? [];
}

const withBlend = () => drawScene([
  box('a', 0, '#ff0000'),
  {
    ...pathEffectNode({ kind: 'blend', steps: 3 }, [asNodeId('a'), asNodeId('b')], 'default', PATH_EFFECT_DERIVATIONS),
    id: asNodeId('blend'),
  } as Spec,
  box('b', 300, '#0000ff'),
]);

describe('a draw document with a blend', () => {
  it('saves and reopens with the blend still live', () => {
    const scene = withBlend();
    expect(steps(scene)).toHaveLength(3);

    const saved = JSON.stringify(scene.toJSON(), serializeReplacer);
    const json = reviveSnapshot(JSON.parse(saved)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const reopened = drawScene(nodeSpecsFromSnapshot(json, DRAW_REGISTRY));

    expect(steps(reopened)).toHaveLength(3);
    // Still derived: moving a source moves the steps.
    reopened.setPose(asNodeId('b'), { x: 300, y: 200, width: 40, height: 40 });
    expect(steps(reopened)[2]!.path).not.toEqual(steps(scene)[2]!.path);
  });

  it('exports what the blend shows, its steps as ordinary paths in their own paint', async () => {
    const warnings: string[] = [];
    const svg = await sceneToSvgString(withBlend(), {
      filename: 'x.svg', pages: layoutPages([{ id: 'page-1', width: 400, height: 300 }]),
      backgroundColor: '#ffffff', onWarn: (m) => warnings.push(m),
    });
    // Two sources and three steps.
    expect(svg.match(/<path\b/g)).toHaveLength(5);
    // The steps' colors run between the sources' red and blue.
    const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]!.toLowerCase());
    expect(new Set(fills).size).toBe(5);
    expect(warnings).toEqual([]);
  });
});

const exportOf = (scene: ReturnType<typeof drawScene>) => sceneToSvgString(scene, {
  filename: 'x.svg', pages: layoutPages([{ id: 'page-1', width: 400, height: 300 }]), backgroundColor: '#ffffff',
});

/** The nodes in `scene` holding a path effect, in render order. */
const effectsIn = (scene: ReturnType<typeof drawScene>) =>
  [...scene.renderOrder()].map((id) => scene.get(id)!).filter((n) => n.data.pathEffect !== undefined);

function liveSteps(scene: ReturnType<typeof drawScene>) {
  const node = effectsIn(scene)[0]!;
  return pathEffectParts(node, (node.dependsOn as NodeId[]).map((id) => derivedDepOf(scene, id))) ?? [];
}

describe('a path effect through draw\'s SVG', () => {
  it('reopens live, over the sources it was made from, in its slot', async () => {
    const reopened = drawScene([]);
    openSvgText(reopened, await exportOf(withBlend()), 'x.svg');

    const [node] = effectsIn(reopened);
    expect(node!.data.pathEffect).toEqual({ kind: 'blend', steps: 3 });
    expect(reopened.roots).toHaveLength(3);
    expect(reopened.roots[1]).toBe(node!.id);
    const [a, b] = node!.dependsOn as NodeId[];
    expect(reopened.get(a!)!.pose.x).toBe(0);
    expect(reopened.get(b!)!.pose.x).toBe(300);
    expect(liveSteps(reopened)).toHaveLength(3);

    const before = liveSteps(reopened)[2]!.path;
    reopened.setPose(b!, { x: 300, y: 200, width: 40, height: 40 });
    expect(liveSteps(reopened)[2]!.path).not.toEqual(before);
  });

  it('imports over its own sources, not the ones of the document it lands in', async () => {
    const target = withBlend();
    importSvgText(target, await exportOf(withBlend()));
    const [mine, imported] = effectsIn(target);
    expect(imported).toBeDefined();
    expect(imported!.dependsOn).not.toEqual(mine!.dependsOn);
    for (const id of imported!.dependsOn as NodeId[]) expect(target.get(id)).toBeDefined();
  });

  it('arrives as plain paths when its sources were not exported with it', async () => {
    const target = drawScene([]);
    importSvgText(target, await selectionToSvgString(withBlend(), ['blend']));
    expect(effectsIn(target)).toEqual([]);
    expect(target.childrenOf(target.roots[0]!)).toHaveLength(3);
  });

  it('round-trips a bend along a path and a repeat along one', async () => {
    const spine: Spec = {
      ...box('s', 0, '#000000'),
      pose: { x: 0, y: 100, width: 300, height: 0 },
      data: { path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 300, 0]), fillRule: 'nonzero' } },
    };
    for (const effect of [
      { kind: 'bendAlong', fit: 'natural' },
      { kind: 'repeatAlong', count: 4, orient: false },
    ] as const) {
      const scene = drawScene([
        box('a', 0, '#ff0000'),
        spine,
        { ...pathEffectNode(effect, [asNodeId('a'), asNodeId('s')], 'default', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') } as Spec,
      ]);
      const reopened = drawScene([]);
      openSvgText(reopened, await exportOf(scene), 'x.svg');
      expect(effectsIn(reopened)[0]!.data.pathEffect).toEqual(effect);
      expect(liveSteps(reopened)).toHaveLength(liveSteps(scene).length);
    }
  });

  it('reopens an effect that paints nothing, though its group is empty', async () => {
    for (const effect of [
      { kind: 'blend', steps: 0 },
      { kind: 'repeatAlong', count: 0, orient: false },
    ] as const) {
      const scene = drawScene([
        box('a', 0, '#ff0000'),
        { ...pathEffectNode(effect, [asNodeId('a'), asNodeId('b')], 'default', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') } as Spec,
        box('b', 300, '#0000ff'),
      ]);
      expect(liveSteps(scene)).toEqual([]);
      const reopened = drawScene([]);
      openSvgText(reopened, await exportOf(scene), 'x.svg');
      const [node] = effectsIn(reopened);
      expect(node?.data.pathEffect).toEqual(effect);
      expect(reopened.roots[1]).toBe(node!.id);
      expect(reopened.roots).toHaveLength(3);

      const alone = drawScene([]);
      importSvgText(alone, await selectionToSvgString(scene, ['fx']));
      expect(alone.roots).toEqual([]);
    }
  });
});

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

/** A text node and a path, both hidden, and a `textAlong` node laying the text along the path. */
function withTextAlong() {
  const words: Spec = {
    kind: 'mark', id: asNodeId('t'), layer: 'default', hidden: true,
    pose: { x: 0, y: 0, width: 300, height: 40 },
    data: { text: 'Hello', style: { fontFamily: 'bars', fontSize: 30 }, fill: { paint: solid('#000000') } },
  };
  const arc: Spec = {
    kind: 'mark', id: asNodeId('p'), layer: 'default', hidden: true,
    pose: { x: 0, y: 100, width: 300, height: 100 },
    data: { path: pathFromD('M0 200 Q150 100 300 200'), stroke: { paint: solid('#000000'), width: 1 } },
  };
  return drawScene([
    words, arc,
    {
      ...pathEffectNode({ kind: 'textAlong', hideSources: true, start: 0.1 }, [asNodeId('t'), asNodeId('p')], 'default', PATH_EFFECT_DERIVATIONS),
      id: asNodeId('fx'),
    } as Spec,
  ]);
}

const partsOf = liveSteps;

describe('a draw document with text along a path', () => {
  beforeEach(async () => {
    _resetFontRegistryForTests();
    _resetFontOutlinesForTests();
    _resetLayoutCacheForTests();
    registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
    await loadTextOutlines({ text: 'Hello', style: { fontFamily: 'bars', fontSize: 30 } });
  });

  it('saves and reopens with its sources still hidden and its glyphs where they were', () => {
    const scene = withTextAlong();
    expect(partsOf(scene)).toHaveLength(5);

    const saved = JSON.stringify(scene.toJSON(), serializeReplacer);
    const json = reviveSnapshot(JSON.parse(saved)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const reopened = drawScene(nodeSpecsFromSnapshot(json, DRAW_REGISTRY));

    expect(reopened.isHidden(asNodeId('t'))).toBe(true);
    expect(reopened.isHidden(asNodeId('p'))).toBe(true);
    expect(effectsIn(reopened)[0]!.data.pathEffect).toEqual({ kind: 'textAlong', hideSources: true, start: 0.1 });
    expect(partsOf(reopened)).toEqual(partsOf(scene));
  });

  it('reopens from its SVG still live, over hidden sources', async () => {
    const scene = withTextAlong();
    const reopened = drawScene([]);
    openSvgText(reopened, await exportOf(scene), 'x.svg');

    const [node] = effectsIn(reopened);
    expect(node!.data.pathEffect).toEqual({ kind: 'textAlong', hideSources: true, start: 0.1 });
    const [t, p] = node!.dependsOn as NodeId[];
    expect(reopened.get(t!)!.data.text).toBe('Hello');
    expect(reopened.isHidden(t!)).toBe(true);
    expect(reopened.isHidden(p!)).toBe(true);
    expect(partsOf(reopened)).toHaveLength(5);

    // Still live: new text lays new glyphs.
    reopened.update(t!, { data: { ...reopened.get(t!)!.data, text: 'Hel' } });
    expect(partsOf(reopened)).toHaveLength(3);
  });
});
