/**
 * The gem extension's preset on two canvases at once, through public imports only: it inserts, paints,
 * picks, routes, and edits on each canvas it is given to, and removing it from one canvas releases only
 * that canvas's installation.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { SceneCanvas, asNodeId, buildSceneViewCommands, createScene, defaultDrawOne, getNodeShapes, findNodeShape, nodeKindPreset, nodeShapesOf, type FeaturePreset, type RectPose, type Scene, type SceneCanvasHit, type ToolsApi } from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui';
import { GEM_BLUE, gemFeature, gemInsert, gemTool, isGem } from './gem-extension/src/index.js';
import { selectPreset } from '@weasel-js/editing';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function pointer(type: string, x: number, y: number): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  return ev;
}

interface Surface {
  scene: Scene<unknown, 'default', RectPose>;
  tools: () => ToolsApi;
  clicks: (SceneCanvasHit | null)[];
}

function surface(): Surface {
  let api: ToolsApi | null = null;
  const s: Surface = {
    scene: createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }] }),
    tools: () => api!,
    clicks: [],
  };
  (s as Surface & { set: (t: ToolsApi) => void }).set = (t) => { api = t; };
  return s;
}

function Host({ a, b, featuresA, featuresB }: { a: Surface; b: Surface; featuresA: readonly FeaturePreset[]; featuresB: readonly FeaturePreset[] }) {
  const canvas = (s: Surface, features: readonly FeaturePreset[], testId: string) => (
    <div data-testid={testId}>
      <SceneCanvas
        scene={s.scene} width={200} height={200} features={features}
        onToolsCreated={(s as Surface & { set: (t: ToolsApi) => void }).set}
        onClick={(hit) => { s.clicks.push(hit); }}
      />
    </div>
  );
  return <>{canvas(a, featuresA, 'a')}{canvas(b, featuresB, 'b')}</>;
}

const canvasOf = (testId: string) => screen.getByTestId(testId).querySelector('canvas')!;

function drag(testId: string, from: [number, number], to: [number, number]) {
  const c = canvasOf(testId);
  act(() => {
    c.dispatchEvent(pointer('pointerdown', ...from));
    c.dispatchEvent(pointer('pointermove', ...to));
    c.dispatchEvent(pointer('pointerup', ...to));
  });
}

function click(testId: string, at: [number, number]) {
  const c = canvasOf(testId);
  act(() => {
    c.dispatchEvent(pointer('pointerdown', ...at));
    c.dispatchEvent(pointer('pointerup', ...at));
  });
}

const gemPainters = (s: Surface) => getNodeShapes(nodeShapesOf(s.scene)).filter((e) => e.id === 'app:gem').length;
/** Whether the scene's frame, as a canvas builds it, paints anything in the gem's color. */
const paintsGem = (s: Surface) =>
  JSON.stringify(buildSceneViewCommands(s.scene, { x: 0, y: 0, scale: { x: 1, y: 1 } }, defaultDrawOne)).includes(GEM_BLUE);

describe('a custom node feature installed as one preset', () => {
  it('inserts, paints, picks, routes and edits on two canvases, and leaves each other when removed', async () => {
    const a = surface();
    const b = surface();
    const on = [selectPreset, gemFeature];
    const view = render(<Host a={a} b={b} featuresA={on} featuresB={on} />);
    await act(async () => {});
    expect(gemPainters(a)).toBe(1);
    expect(gemPainters(b)).toBe(1);

    for (const [s, id] of [[a, 'a'], [b, 'b']] as const) {
      expect(s.tools().has('gem')).toBe(true);
      act(() => s.tools().setActive('gem'));
      drag(id, [0, 0], [100, 100]);
      const nodes = [...s.scene.nodes.values()];
      expect(nodes).toHaveLength(1);
      const node = nodes[0]!;
      expect(node.data).toEqual({ gem: { color: GEM_BLUE, facets: 4 } });
      expect(node.pose).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });

      // Drawn by its painter, as the canvas paints it.
      expect(findNodeShape(node, nodeShapesOf(s.scene))?.id).toBe('app:gem');
      expect(paintsGem(s)).toBe(true);

      // Picked by its outline and routed as its kind.
      act(() => s.tools().setActive('select'));
      click(id, [50, 50]);
      expect(s.clicks.at(-1)).toMatchObject({ id: node.id, kind: 'gem' });
      click(id, [3, 97]);
      expect(s.clicks.at(-1)).toBeNull();
    }

    // The property editor reads its kind and schema from the same preset list.
    const node = [...a.scene.nodes.values()][0]!;
    const panel = render(<SelectionPanel scene={a.scene} selection={{ current: [node.id] }} features={on} />);
    expect(panel.container.textContent).toContain('Gem');
    expect(panel.container.textContent).toContain('Facets');
    panel.unmount();

    // Off canvas A: its tool, insert and routing go; B's installation, painter included, stays.
    view.rerender(<Host a={a} b={b} featuresA={[selectPreset]} featuresB={on} />);
    await act(async () => {});
    expect(a.tools().has('gem')).toBe(false);
    expect(b.tools().has('gem')).toBe(true);
    expect(gemPainters(a)).toBe(0);
    expect(gemPainters(b)).toBe(1);
    expect(paintsGem(a)).toBe(false);
    expect(paintsGem(b)).toBe(true);
    click('a', [50, 50]);
    expect(a.clicks.at(-1)).toMatchObject({ kind: 'unknown' });
    click('b', [50, 50]);
    expect(b.clicks.at(-1)).toMatchObject({ kind: 'gem' });

    view.rerender(<Host a={a} b={b} featuresA={[selectPreset]} featuresB={[selectPreset]} />);
    await act(async () => {});
    expect(gemPainters(b)).toBe(0);
    expect(findNodeShape(node, nodeShapesOf(a.scene))?.id).not.toBe('app:gem');
  });

  it('paints and picks a gem only on the canvas whose scene installed the feature', async () => {
    const a = surface();
    const b = surface();
    const gem = { kind: 'mark' as const, layer: 'default' as const, pose: { x: 0, y: 0, width: 100, height: 100 }, data: { gem: { color: GEM_BLUE, facets: 4 } } };
    a.scene.add({ id: asNodeId('g'), ...gem });
    b.scene.add({ id: asNodeId('g'), ...gem });
    render(<Host a={a} b={b} featuresA={[selectPreset, gemFeature]} featuresB={[selectPreset]} />);
    await act(async () => {});

    expect(paintsGem(a)).toBe(true);
    expect(paintsGem(b)).toBe(false);
    expect(findNodeShape(b.scene.get(asNodeId('g'))!)?.id).not.toBe('app:gem');
    // Outside the gem's outline but inside its box: A picks by the outline, B by the box.
    click('a', [3, 97]);
    expect(a.clicks.at(-1)).toBeNull();
    click('b', [3, 97]);
    expect(b.clicks.at(-1)).toMatchObject({ id: 'g' });
  });

  it('leaves out a tool whose insert factory came from a preset that is gone', async () => {
    const tool = nodeKindPreset({ id: 'app:gem-tool', kind: 'gem', matches: isGem, tools: [gemTool] });
    const factory = nodeKindPreset({ id: 'app:gem-insert', kind: 'gem', matches: isGem, insert: gemInsert });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = surface();
    const b = surface();
    const view = render(<Host a={a} b={b} featuresA={[selectPreset, tool, factory]} featuresB={[selectPreset]} />);
    await act(async () => {});
    expect(a.tools().has('gem')).toBe(true);

    view.rerender(<Host a={a} b={b} featuresA={[selectPreset, tool]} featuresB={[selectPreset]} />);
    await act(async () => {});
    expect(a.tools().has('gem')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tool "gem" is left out'));
    warn.mockRestore();
  });

  it('throws when two presets give one kind different values', () => {
    const one = nodeKindPreset({ id: 'one', kind: 'gem', matches: isGem });
    const two = nodeKindPreset({ id: 'two', kind: 'gem', matches: (d) => isGem(d) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = surface();
    const b = surface();
    expect(() => render(<Host a={a} b={b} featuresA={[one, two]} featuresB={[]} />))
      .toThrow('presets "one" and "two" both give routing entry "gem"');
    err.mockRestore();
  });
});
