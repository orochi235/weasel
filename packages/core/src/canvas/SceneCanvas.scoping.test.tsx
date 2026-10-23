import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { buildSceneLayer } from './buildSceneLayer';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import type { DrawCommand } from '@weasel-js/renderer';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 300, height: 300 };

type TData = { label: string };
type TLayer = 'bg';

function makeScene() {
  const scene = createScene<TData, TLayer, typeof POSE>({
    systemLayers: [{ id: 'bg' }],
  });
  const aId = scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'a' } });
  const bId = scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'b' } });
  const adapter = sceneToAdapter(scene);
  return { scene, adapter, aId, bId };
}

describe('buildSceneLayer — alphaFor', () => {
  it('wraps dimmed-node commands in a group with the specified alpha', () => {
    const { adapter, aId, bId } = makeScene();

    // alphaFor returns 0.3 for node 'b', 1 for node 'a'
    const alphaFor = (id: string) => (id === bId ? 0.3 : 1);

    const layer = buildSceneLayer(
      {
        drawOne: () => [
          { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: 'red' } } },
        ],
        alphaFor,
      },
      adapter as never,
      () => null,
      () => null,
    );

    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    // Top-level: [ viewGroup ]
    expect(out).toHaveLength(1);
    const viewGroup = out[0] as { kind: string; children: DrawCommand[] };
    expect(viewGroup.kind).toBe('group');

    // Collect every { kind: 'group', alpha: <number> } node, at any depth.
    function collectAlphaGroups(cmds: DrawCommand[]): { alpha: number }[] {
      const result: { alpha: number }[] = [];
      for (const cmd of cmds) {
        if (cmd.kind === 'group') {
          if ((cmd as { alpha?: number }).alpha != null) {
            result.push({ alpha: (cmd as { alpha?: number }).alpha! });
          }
          result.push(...collectAlphaGroups((cmd as { children: DrawCommand[] }).children));
        }
      }
      return result;
    }

    const alphaGroups = collectAlphaGroups(out);
    // Exactly one alpha-group must appear, for node 'b' with alpha 0.3
    expect(alphaGroups).toHaveLength(1);
    expect(alphaGroups[0].alpha).toBe(0.3);

    // Suppress unused-var warning in tests — both ids are used via alphaFor
    void aId;
  });

  it('emits no alpha-group when alphaFor always returns 1 (no-op case)', () => {
    const { adapter } = makeScene();

    const layer = buildSceneLayer(
      {
        drawOne: () => [
          { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: 'blue' } } },
        ],
        alphaFor: () => 1,
      },
      adapter as never,
      () => null,
      () => null,
    );

    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];

    function hasAlphaGroup(cmds: DrawCommand[]): boolean {
      for (const cmd of cmds) {
        if (cmd.kind === 'group') {
          if ((cmd as { alpha?: number }).alpha != null) return true;
          if (hasAlphaGroup((cmd as { children: DrawCommand[] }).children)) return true;
        }
      }
      return false;
    }

    expect(hasAlphaGroup(out)).toBe(false);
  });
});

describe('SceneCanvas isPointerInteractive', () => {
  beforeAll(() => {
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    proto.getContext = vi.fn(() => null);
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
  });

  it('reports a click on a rejected node as a miss and still reports its neighbor', () => {
    const scene = createScene<TData, TLayer, typeof POSE>({ systemLayers: [{ id: 'bg' }] });
    const aId = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'a' } });
    const bId = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 20, y: 0, width: 10, height: 10 }, data: { label: 'b' } });
    const onClick = vi.fn();
    const { container } = render(
      <SceneCanvas
        features={['pick']} scene={scene} layers={{}} width={200} height={200}
        isPointerInteractive={(id) => id !== bId}
        onClick={onClick}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    const click = (x: number, y: number) => act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    });

    click(5, 5);
    expect(onClick.mock.calls[0]![0]).toMatchObject({ id: aId });
    click(25, 5);
    expect(onClick.mock.calls[1]![0]).toBeNull();
  });

  function setup(rejected: (ids: { a: string; b: string }) => string, bPose = { x: 20, y: 0, width: 10, height: 10 }) {
    const scene = createScene<TData, TLayer, typeof POSE>({ systemLayers: [{ id: 'bg' }] });
    const a = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'mark', layer: 'bg', pose: bPose, data: { label: 'b' } });
    const out = rejected({ a, b });
    const { container } = render(
      <SceneCanvas
        features={['draw']} scene={scene} layers={{}} width={200} height={200}
        isPointerInteractive={(id) => id !== out}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    const click = (x: number, y: number) => act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
    });
    return { scene, a, b, click };
  }

  it('a click on a rejected node selects nothing', () => {
    const t = setup(({ b }) => b);
    t.click(25, 5);
    expect(t.scene.getSelection()).toEqual([]);
  });

  it('a click on a rejected node reaches the node beneath it', () => {
    const t = setup(({ b }) => b, { x: 0, y: 0, width: 10, height: 10 });
    t.click(5, 5);
    expect(t.scene.getSelection()).toEqual([t.a]);
  });
});
