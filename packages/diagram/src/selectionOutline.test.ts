import { afterAll, describe, expect, it } from 'vitest';
import { createScene, createSelectionOverlayLayer, type RectPose } from '@weasel-js/core';
import { pathContainsPoint, polygonFromPoints, type Path } from '@weasel-js/geom';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DataNode } from './fromData';
import { registerOutline } from './outline';
import { roundRectOutline } from './outlines/figures';
import { registerDiagramShape } from './shape';

const disposers = [registerDiagramShape<RectPose>(), registerOutline('card', roundRectOutline(5))];
afterAll(() => disposers.forEach((d) => d()));

const ROWS: DataNode['rows'] = [{ kind: 'header', text: 'Title' }, { kind: 'label', text: 'one' }, { kind: 'label', text: 'two' }];
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600, dpr: 1 };
type Cmd = { kind: string; path?: Path; children?: Cmd[] };

function outlined(nodes: DataNode[], id: string, containers?: Parameters<typeof diagramScene>[0]['containers']) {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
    initial: diagramScene({ nodes, edges: [], ...(containers ? { containers } : {}) }, { layout: 'none' }) as never,
  });
  const layer = createSelectionOverlayLayer<RectPose>({
    getSelection: () => [id as never], getPose: (n) => scene.get(n as never)!.pose, scene: scene as never, handles: false,
    outline: { paint: { kind: 'solid', color: '#f00' }, width: 2, follow: 'shape' },
  });
  const cmds = layer.draw(undefined, VIEW, DIMS) as Cmd[];
  return { traced: cmds.find((c) => c.kind === 'group')?.children?.[0]?.path, pose: scene.get(id as never)!.pose };
}

describe("a diagram node's selection outline", () => {
  it('follows a registered rounded outline, rows and all', () => {
    const { traced, pose } = outlined([{ id: 'n', at: { x: 0, y: 0 }, outline: 'card', rows: ROWS }], 'n');
    expect(traced).toBeDefined();
    // Just inside the box's corner, which a rounded corner leaves out.
    expect(pathContainsPoint(traced!, pose.x + 0.2, pose.y + 0.2)).toBe(false);
    expect(pathContainsPoint(traced!, pose.x + pose.width / 2, pose.y + 0.2)).toBe(true);
  });

  it('follows the built-in roundRect, and a rect to its corners', () => {
    const round = outlined([{ id: 'n', at: { x: 0, y: 0 }, outline: 'roundRect', rows: ROWS }], 'n');
    expect(pathContainsPoint(round.traced!, round.pose.x + 0.2, round.pose.y + 0.2)).toBe(false);
    const square = outlined([{ id: 'n', at: { x: 0, y: 0 }, outline: 'rect', rows: ROWS }], 'n');
    expect(pathContainsPoint(square.traced!, square.pose.x + 0.2, square.pose.y + 0.2)).toBe(true);
  });

  it('follows a custom path outline', () => {
    const diamond = polygonFromPoints([{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }]);
    const { traced, pose } = outlined([{ id: 'n', at: { x: 0, y: 0 }, outline: diamond, rows: ROWS }], 'n');
    expect(pathContainsPoint(traced!, pose.x + pose.width / 2, pose.y + pose.height / 2)).toBe(true);
    expect(pathContainsPoint(traced!, pose.x + 2, pose.y + 2)).toBe(false);
  });

  it('keeps the box for a container holding members', () => {
    const { traced } = outlined([{ id: 'n', at: { x: 20, y: 40 }, rows: ROWS }], 'box', [{ id: 'box', role: 'container', label: 'Box', members: ['n'] }]);
    expect(traced).toBeUndefined();
  });
});
