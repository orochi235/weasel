/** The sticky tool draws with its own options, the paper and the ink, not the shapes' shared fill. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createToolOptionValues, SHARED_TOOL_OPTIONS, type LastOperationStore, type ToolOptionValues } from '@weasel-js/routing';
import { lastOperationOf, useActionsRegistry } from '@weasel-js/routing/react';
import { SceneCanvas, createScene, type Scene } from '@weasel-js/core';
import { textToolsPreset } from '../../presets';

type D = Record<string, unknown>;
type L = 'main';
type P = { x: number; y: number; width: number; height: number; rotation: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (id: number) => void;
    releasePointerCapture: (id: number) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function GrabLastOperation({ into }: { into: { current: LastOperationStore | null } }) {
  into.current = lastOperationOf(useActionsRegistry());
  return null;
}

function mount(values?: ToolOptionValues) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const store: { current: LastOperationStore | null } = { current: null };
  const { container } = render(
    <SceneCanvas scene={scene} width={200} height={200} features={[textToolsPreset]} defaultActiveTool="sticky"
      toolOptionValues={values}>
      <GrabLastOperation into={store} />
    </SceneCanvas>,
  );
  const canvas = container.querySelector('canvas')!;
  const at = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
  const drag = () => act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', at(20, 20)));
    canvas.dispatchEvent(new PointerEvent('pointermove', at(120, 100)));
    canvas.dispatchEvent(new PointerEvent('pointerup', at(120, 100)));
  });
  const click = () => act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', at(60, 60)));
    canvas.dispatchEvent(new PointerEvent('pointerup', at(60, 60)));
  });
  return { scene, drag, click, lastOperation: () => store.current?.get() ?? null, store };
}

const only = (scene: Scene<D, L, P>) => {
  const nodes = scene.renderOrderNodes();
  expect(nodes).toHaveLength(1);
  return nodes[0]!.data as { background?: unknown };
};

describe('a sticky note’s style', () => {
  it('is the paper its own option holds, not the shapes’ fill', () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#112233' });
    values.set('sticky', 'paper', { color: '#abcdef' });
    const { scene, drag } = mount(values);
    drag();
    expect(only(scene).background).toEqual({ paint: { color: '#abcdef' } });
  });

  it('is on the last-operation panel after a placing click, as its paper and ink', () => {
    const values = createToolOptionValues();
    const { scene, click, lastOperation, store } = mount(values);
    click();
    expect(lastOperation()?.id).toBe('place');
    expect(Object.keys(lastOperation()!.schema.children)).toEqual(['paper', 'ink']);
    act(() => { store.current!.adjust({ paper: { color: '#abcdef' } }); });
    expect(only(scene).background).toEqual({ paint: { color: '#abcdef' } });
    expect(values.get('sticky')).toMatchObject({ paper: { color: '#abcdef' } });
  });
});
