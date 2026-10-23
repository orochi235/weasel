/**
 * The scene slot paints one canvas layer per scene layer, so the set of them
 * has to follow the scene's layer list after mount, not only at it.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type Scene } from 'core/scene/types';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { SceneCanvas } from './SceneCanvas';

const painted = vi.hoisted(() => ({ commands: [] as readonly unknown[] }));

vi.mock('@weasel-js/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/renderer')>()),
  WeaselRenderer: class {
    render(commands: readonly unknown[]): void { painted.commands = commands; }
    resize(): void {}
    setTarget(): void {}
    dispose(): void {}
    registerProgram(): void {}
  },
}));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const gl = { enable: () => {} };
  proto.getContext = function getContext(kind: string) { return kind === 'webgl2' ? gl : null; };
});

beforeEach(() => { painted.commands = []; });

type D = { color: string };
type L = 'base' | 'fx';
type P = { x: number; y: number; width: number; height: number };

const BASE = '#0000ff';
const FX = '#ff0000';

const LAYERS = {
  scene: {
    drawOne: (n: Node<D, L, P>, p: P): DrawCommand[] => [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { paint: { color: n.data.color } },
    }],
  },
};

function colors(): string[] {
  const out: string[] = [];
  const walk = (list: readonly unknown[]): void => {
    for (const c of list as DrawCommand[]) {
      if (c.kind === 'group') walk((c as GroupDrawCommand).children ?? []);
      else {
        const color = (c as { fill?: { paint?: { color?: string } } }).fill?.paint?.color;
        if (color) out.push(color);
      }
    }
  };
  walk(painted.commands);
  return out;
}

const nextFrame = () => act(async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
});

function mount(): Scene<D, L, P> {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'base' }] });
  scene.add({ kind: 'mark', id: asNodeId('a'), layer: 'base', data: { color: BASE }, pose: { x: 0, y: 0, width: 10, height: 10 } });
  render(<SceneCanvas features={['draw']} scene={scene} width={300} height={200} layers={LAYERS} />);
  return scene;
}

describe('<SceneCanvas> scene layers changed after mount', () => {
  it('paints a node on a layer added after mount', async () => {
    const scene = mount();
    await nextFrame();
    expect(colors()).toEqual([BASE]);

    act(() => {
      scene.addLayer({ id: 'fx', name: 'Effects' });
      scene.add({ kind: 'mark', id: asNodeId('b'), layer: 'fx', data: { color: FX }, pose: { x: 20, y: 0, width: 10, height: 10 } });
    });
    // One frame: the canvas hears of the change from the adapter, not from a paint.
    await nextFrame();
    expect(colors()).toEqual([BASE, FX]);
  });

  it('stops painting a layer removed after mount', async () => {
    const scene = mount();
    act(() => {
      scene.addLayer({ id: 'fx', name: 'Effects' });
      scene.add({ kind: 'mark', id: asNodeId('b'), layer: 'fx', data: { color: FX }, pose: { x: 20, y: 0, width: 10, height: 10 } });
    });
    await nextFrame();
    act(() => { scene.removeLayer('fx'); });
    await nextFrame();
    expect(colors()).toEqual([BASE]);
  });
});
