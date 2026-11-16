/**
 * A shape tool draws with its options: the style every shape tool shares, and
 * its own count, held in `<SceneCanvas toolOptionValues>` or the canvas's own store.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createToolOptionValues, SHARED_TOOL_OPTIONS, type LastOperationStore, type ToolOptionValues } from '@weasel-js/routing';
import { DepRegistryProvider, lastOperationOf, useActionsRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { useToolOptionValues } from '../tools/toolOptions';
import { DEFAULT_SHAPE_PAINT } from '../tools/builtin/shared/styleOptions';

type D = Record<string, unknown>;
type L = 'main';
type P = { x: number; y: number; width: number; height: number; rotation: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function Publish({ values }: { values: ToolOptionValues }) {
  useToolOptionValues(values);
  return null;
}

function GrabLastOperation({ into }: { into: { current: LastOperationStore | null } }) {
  into.current = lastOperationOf(useActionsRegistry());
  return null;
}

function mount(tool: string, values?: ToolOptionValues) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const store: { current: LastOperationStore | null } = { current: null };
  const { container } = render(
    <SceneCanvas scene={scene} width={200} height={200} defaultTools={['rect', 'polygon', 'line']} defaultActiveTool={tool}
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
  return { scene, drag, lastOperation: () => store.current?.get() ?? null, store };
}

function drawWith(tool: string, values?: ToolOptionValues): Scene<D, L, P> {
  const { scene, drag } = mount(tool, values);
  drag();
  return scene;
}

const only = (scene: Scene<D, L, P>) => {
  const nodes = scene.renderOrderNodes();
  expect(nodes).toHaveLength(1);
  return nodes[0]!.data as { fill?: unknown; stroke?: unknown; background?: unknown; generator?: { sides: number } };
};

describe('a shape tool’s style', () => {
  it('is its options’ defaults on a canvas whose host keeps none', () => {
    const data = only(drawWith('rect'));
    expect(data.fill).toEqual({ paint: DEFAULT_SHAPE_PAINT });
    expect(data.stroke).toBeNull();
  });

  it('is the shared fill and stroke the host holds, at the shared width', () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#112233' });
    values.set(SHARED_TOOL_OPTIONS, 'stroke', { color: '#445566' });
    values.set(SHARED_TOOL_OPTIONS, 'strokeWidth', 4);
    const data = only(drawWith('rect', values));
    expect(data.fill).toEqual({ paint: { color: '#112233' } });
    expect(data.stroke).toEqual({ paint: { color: '#445566' }, width: 4 });
  });

  it('leaves a line unfilled whatever fill is shared', () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#112233' });
    const data = only(drawWith('line', values));
    expect(data.fill).toBeNull();
    expect(data.stroke).toEqual({ paint: DEFAULT_SHAPE_PAINT, width: 2 });
  });

  it('gives a polygon the side count its own option holds', () => {
    const values = createToolOptionValues();
    values.set('polygon', 'sides', 5);
    expect(only(drawWith('polygon', values)).generator?.sides).toBe(5);
  });

  it('gives the next polygon a side count its option took after the last one committed', () => {
    const values = createToolOptionValues();
    values.set('polygon', 'sides', 5);
    const { scene, drag } = mount('polygon', values);
    drag();
    act(() => values.set('polygon', 'sides', 8));
    drag();
    const sides = scene.renderOrderNodes().map((n) => (n.data as { generator?: { sides: number } }).generator?.sides);
    expect(sides).toEqual([5, 8]);
  });
});

describe('a shape tool’s style after the shape is drawn', () => {
  it('is on the last-operation panel, which redraws the shape and keeps the value as the shared option', () => {
    const values = createToolOptionValues();
    const { scene, drag, lastOperation, store } = mount('rect', values);
    drag();
    const op = lastOperation();
    expect(op?.id).toBe('insert');
    expect(Object.keys(op!.schema.children)).toEqual(['fill', 'stroke', 'strokeWidth']);
    expect(op!.values).toMatchObject({ fill: DEFAULT_SHAPE_PAINT, stroke: null, strokeWidth: 2 });
    act(() => { store.current!.adjust({ stroke: { color: '#445566' }, strokeWidth: 6 }); });
    expect(only(scene).stroke).toEqual({ paint: { color: '#445566' }, width: 6 });
    expect(values.get(SHARED_TOOL_OPTIONS)).toMatchObject({ stroke: { color: '#445566' }, strokeWidth: 6 });
  });

  it('shows a polygon’s sides beside its style', () => {
    const { drag, lastOperation } = mount('polygon');
    drag();
    expect(Object.keys(lastOperation()!.schema.children)).toEqual(['fill', 'stroke', 'strokeWidth', 'fillRule', 'sides']);
  });
});

describe('where a canvas keeps its tools’ options', () => {
  const fillOf = (values: ToolOptionValues) => (values.get(SHARED_TOOL_OPTIONS) as { fill?: unknown }).fill;
  const red = () => { const v = createToolOptionValues(); v.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#ff0000' }); return v; };
  const blue = () => { const v = createToolOptionValues(); v.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#0000ff' }); return v; };

  function draw(canvas: (scene: Scene<D, L, P>) => ReactElement): Scene<D, L, P> {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(canvas(scene));
    const el = container.querySelector('canvas')!;
    const at = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
    act(() => {
      el.dispatchEvent(new PointerEvent('pointerdown', at(20, 20)));
      el.dispatchEvent(new PointerEvent('pointermove', at(120, 100)));
      el.dispatchEvent(new PointerEvent('pointerup', at(120, 100)));
    });
    return scene;
  }

  it('is the prop’s store over one published beneath the canvas', () => {
    const prop = red();
    const beneath = blue();
    const scene = draw((s) => (
      <DepRegistryProvider>
        <Publish values={beneath} />
        <SceneCanvas scene={s} width={200} height={200} defaultTools={['rect']} defaultActiveTool="rect" toolOptionValues={prop} />
      </DepRegistryProvider>
    ));
    expect(only(scene).fill).toEqual({ paint: fillOf(prop) });
  });

  it('is a store a child publishes, over the prop', () => {
    const prop = red();
    const child = blue();
    const scene = draw((s) => (
      <SceneCanvas scene={s} width={200} height={200} defaultTools={['rect']} defaultActiveTool="rect" toolOptionValues={prop}>
        <Publish values={child} />
      </SceneCanvas>
    ));
    expect(only(scene).fill).toEqual({ paint: fillOf(child) });
  });
});
