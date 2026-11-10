/**
 * A shape tool draws with its options: the style every shape tool shares, and
 * its own count, held by the host's `toolOptionValues` or the canvas's own.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createToolOptionValues, SHARED_TOOL_OPTIONS, type ToolOptionValues } from '@weasel-js/routing';
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

function mount(tool: string, values?: ToolOptionValues) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const { container } = render(
    <SceneCanvas scene={scene} width={200} height={200} defaultTools={['rect', 'polygon', 'line', 'sticky']} initialActiveTool={tool}>
      {values && <Publish values={values} />}
    </SceneCanvas>,
  );
  const canvas = container.querySelector('canvas')!;
  const at = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
  const drag = () => act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', at(20, 20)));
    canvas.dispatchEvent(new PointerEvent('pointermove', at(120, 100)));
    canvas.dispatchEvent(new PointerEvent('pointerup', at(120, 100)));
  });
  return { scene, drag };
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

  it('gives a sticky note the paper its own option holds, not the shapes’ fill', () => {
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#112233' });
    values.set('sticky', 'paper', { color: '#abcdef' });
    expect(only(drawWith('sticky', values)).background).toEqual({ paint: { color: '#abcdef' } });
  });
});
