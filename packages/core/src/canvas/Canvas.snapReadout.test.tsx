/**
 * The snap readout layer draws the store the `snapReadout` dep exposes, and
 * `snap={{ readout: false }}` leaves it off.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasSnap } from 'features/snap/types';
import type { SnapReadoutDep } from 'features/snap/readoutDep';
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

beforeEach(() => { painted.commands = []; cleanup(); });

const nextFrame = () => act(async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
});

const MARK_COLOR = '#12ab34';

function strokeColors(): string[] {
  const out: string[] = [];
  const walk = (list: readonly unknown[]): void => {
    for (const c of list as DrawCommand[]) {
      if (c.kind === 'group') walk((c as GroupDrawCommand).children ?? []);
      else {
        const color = (c as { stroke?: { paint?: { color?: string } } }).stroke?.paint?.color;
        if (color) out.push(color);
      }
    }
  };
  walk(painted.commands);
  return out;
}

async function mountWith(snap?: SceneCanvasSnap): Promise<SnapReadoutDep> {
  let reg!: DepRegistry;
  function Probe() { reg = useDepRegistry(); return null; }
  const scene = createScene<object, 'base', { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'base' }],
  });
  render(
    <SceneCanvas features={['draw']} scene={scene} width={300} height={200} {...(snap ? { snap } : {})}>
      <Probe />
    </SceneCanvas>,
  );
  await nextFrame();
  return (reg.get as (n: string) => unknown)('snapReadout') as SnapReadoutDep;
}

describe('<SceneCanvas> snap readout', () => {
  it('draws the marks in the store its snapReadout dep exposes', async () => {
    const { store } = await mountWith();
    act(() => { store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, color: MARK_COLOR }]); });
    await nextFrame();
    expect(strokeColors()).toContain(MARK_COLOR);
  });

  it('mounts no readout layer with readout: false', async () => {
    const { store } = await mountWith({ readout: false });
    act(() => { store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, color: MARK_COLOR }]); });
    await nextFrame();
    expect(strokeColors()).not.toContain(MARK_COLOR);
  });
});
