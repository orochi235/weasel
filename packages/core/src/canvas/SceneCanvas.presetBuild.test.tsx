/**
 * A preset's `build` and `selection`: the parts a feature makes from the canvas it runs on, which is how editing
 * hands a canvas its select tool, shape tools and selection without the canvas building any of them in.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { defineTool, type SelectionApi } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import type { FeaturePreset } from './SceneCanvas/features';
import type { PresetBuildContext } from './SceneCanvas/presetBuild';
import type { SelectionFactory } from 'core/selection/selectionContract';
import type { ToolsApi } from '../tools/overlayBinding';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

type P = { x: number; y: number; width: number; height: number };

function makeScene() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 }, data: {} });
  return { scene, id };
}

const stamp = defineTool({ id: 'stamp', presentation: { label: 'Stamp' } });
const spare = defineTool({ id: 'spare', presentation: { label: 'Spare' } });

function mount(features: readonly FeaturePreset[], extra: { defaultTools?: string[] } = {}) {
  const { scene, id } = makeScene();
  let tools!: ToolsApi;
  render(
    <SceneCanvas scene={scene} layers={{}} width={100} height={100} features={features}
      onToolsCreated={(t) => { tools = t; }} {...extra} />,
  );
  return { scene, id, tools: () => tools };
}

describe('FeaturePreset.build', () => {
  it('offers tools by id: one a preset names is mounted, one nobody names is not', () => {
    const kit: FeaturePreset = { id: 'kit', build: () => ({ tools: { stamp, spare } }) };
    const user: FeaturePreset = { id: 'user', tools: ['stamp'], includes: [kit] };
    const { tools } = mount([user]);
    expect(Object.keys(tools().registry)).toContain('stamp');
    expect(Object.keys(tools().registry)).not.toContain('spare');
  });

  it('mounts an offered tool `defaultTools` names', () => {
    const kit: FeaturePreset = { id: 'kit', build: () => ({ tools: { stamp, spare } }) };
    const { tools } = mount([kit], { defaultTools: ['spare'] });
    expect(Object.keys(tools().registry)).toEqual(['spare']);
  });

  it('hands build the canvas: its scene, its pickers, and its selection read live', () => {
    let ctx!: PresetBuildContext;
    const kit: FeaturePreset = { id: 'kit', build: (c) => { ctx = c; return {}; } };
    const { scene, id } = mount([kit]);
    expect(ctx.scene()).toBe(scene);
    expect(ctx.pick.pressEvery({ x: 10, y: 10 })).toEqual([id]);
    expect(ctx.pick.bestIn({ x: 80, y: 80 })).toBeNull();
    expect(ctx.pick.boundsOf(id)).toMatchObject({ x: 0, y: 0, width: 50, height: 50 });
    act(() => { scene.setSelection([id]); });
    expect(ctx.selection().get()).toEqual([id]);
  });

  it('builds once, not on every render, and not again for a new scene', () => {
    const build = vi.fn(() => ({}));
    const kit: FeaturePreset = { id: 'kit', build };
    const first = makeScene();
    let ctx: PresetBuildContext | undefined;
    const spy: FeaturePreset = { id: 'spy', build: (c) => { ctx = c; return {}; } };
    const { rerender } = render(<SceneCanvas scene={first.scene} layers={{}} width={100} height={100} features={[kit, spy]} />);
    const calls = build.mock.calls.length;
    act(() => { first.scene.setSelection([first.id]); });
    const second = makeScene();
    rerender(<SceneCanvas scene={second.scene} layers={{}} width={100} height={100} features={[kit, spy]} />);
    expect(build.mock.calls.length).toBe(calls);
    expect(ctx!.scene()).toBe(second.scene);
  });

  it('installs the contributions it builds', () => {
    const kit: FeaturePreset = {
      id: 'kit',
      build: () => ({ contributions: [{ id: 'kit.extra', eligibility: {}, bindings: [] }] }),
    };
    const { tools } = mount([kit]);
    expect(tools().ambient.map((c) => c.id)).toContain('kit.extra');
  });
});

describe('FeaturePreset.selection', () => {
  const writable: SelectionFactory = (store) => {
    const get = () => store.getSelection() as NodeId[];
    const set = (ids: NodeId[]) => store.setSelection(ids);
    const api: SelectionApi = {
      get current() { return get(); },
      get, set,
      add: (id) => set([...get(), id]), remove: (id) => set(get().filter((x) => x !== id)),
      toggle: (id) => set(get().includes(id) ? get().filter((x) => x !== id) : [...get(), id]),
      clear: () => set([]), contains: (id) => get().includes(id),
      applyClick: (id) => set([id]), intentOf: () => 'replace',
      adapterMethods: { getSelection: get, setSelection: set },
    };
    return api;
  };

  it('builds the selection the canvas writes through', () => {
    let ctx!: PresetBuildContext;
    const kit: FeaturePreset = { id: 'kit', selection: writable, build: (c) => { ctx = c; return {}; } };
    const { scene, id } = mount([kit]);
    act(() => { ctx.selection().set([id]); });
    expect(scene.getSelection()).toEqual([id]);
  });

  it('throws when two presets build it differently', () => {
    const a: FeaturePreset = { id: 'a', selection: writable };
    const b: FeaturePreset = { id: 'b', selection: (store, o) => writable(store, o) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => mount([a, b])).toThrow(/both build the canvas's selection/);
  });
});
