import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION, createScene } from '@weasel-js/core';
import { brokenConstraintLinks, constraintLinkNode } from './constraintLinks';
import { constraintLinkMarks, createConstraintLinkMarks } from './constraintLinkMarks';
import type { CanvasExtensionApi, ContributionDepReader, RenderLayer } from '@weasel-js/core';

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;
const STYLE = { stroke: '#0e9f8e', conflictStroke: '#e5484d' };

/** A square and a triangle whose anchor 0 is held on the square's bottom edge, at `y` below it. */
function setup(y: number) {
  const scene = createScene<Record<string, unknown>, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const square = scene.add({ kind: 'mark', layer: 'main', pose: poly([0, 0], [100, 0], [100, 100], [0, 100]), data: {} });
  const triangle = scene.add({ kind: 'mark', layer: 'main', pose: poly([40, y], [40, -50], [10, -50]), data: {} });
  const link = scene.add(constraintLinkNode<unknown>({
    layer: 'main', nodes: [triangle, square], constraint: { kind: 'onPath', anchor: 0, segment: [3, 4] },
  }) as never);
  return { scene, link };
}

describe('broken constraint link marks', () => {
  it('finds only the links that do not hold', () => {
    expect(brokenConstraintLinks(setup(0).scene)).toEqual([]);
    const { scene, link } = setup(-20);
    expect(brokenConstraintLinks(scene).map((l) => l.id)).toEqual([link]);
  });

  it('marks a broken link in the conflict color, with a dashed line to where it wants its anchor', () => {
    const { scene } = setup(-20);
    const marks = constraintLinkMarks(brokenConstraintLinks(scene), (p) => ({ x: p.x * 2, y: p.y * 2 }), STYLE);
    expect(marks).toHaveLength(2);
    for (const m of marks) expect((m as { stroke: { paint: { color: string } } }).stroke.paint.color).toBe('#e5484d');
    const dashed = marks[1] as { path: PolygonPath; stroke: { dash?: number[] } };
    expect(dashed.stroke.dash).toBeDefined();
    expect(Array.from(dashed.path.coords)).toEqual([80, -40, 80, 0]);
  });

  /** Attach `entry` to a stand-in canvas over `scene`; returns the layer it registered and the detach. */
  function attachTo(entry: ReturnType<typeof createConstraintLinkMarks>, scene: unknown) {
    const layers: RenderLayer<unknown>[] = [];
    const api = {
      registerLayer: (l: RenderLayer<unknown>) => {
        layers.push(l);
        return () => { layers.splice(layers.indexOf(l), 1); };
      },
      requestRedraw: () => {},
    } as unknown as CanvasExtensionApi;
    const detach = entry.attach!(api, { get: () => scene } as unknown as ContributionDepReader);
    return { layers, detach };
  }
  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } } as never;
  const draw = (layer: RenderLayer<unknown> | undefined, data?: unknown) => layer!.draw(data, view, undefined as never);

  it('draws the scene\'s broken links as a screen layer once attached, and nothing in a view pass', () => {
    const { scene } = setup(-20);
    const { layers, detach } = attachTo(createConstraintLinkMarks(STYLE), scene);
    expect(layers).toHaveLength(1);
    expect(draw(layers[0])).toHaveLength(2);
    expect(draw(layers[0], { viewId: 'v' })).toEqual([]);
    detach();
    expect(layers).toEqual([]);
  });

  it('draws each canvas its own scene\'s links when one entry is installed in two', () => {
    const entry = createConstraintLinkMarks(STYLE);
    const broken = attachTo(entry, setup(-20).scene);
    const holding = attachTo(entry, setup(0).scene);
    expect(draw(broken.layers[0])).toHaveLength(2);
    expect(draw(holding.layers[0])).toEqual([]);
    holding.detach();
    expect(draw(broken.layers[0])).toHaveLength(2);
  });
});
