/**
 * Kit-vs-kit route conflicts are always a bug, and this is where they fail.
 *
 * `useTools` reports route conflicts with a `console.warn` at dev-time, which
 * is the right severity for a *consumer's* tool colliding with a kit tool —
 * that can be deliberate, since the loser can still take the gesture by
 * declining through `enabled()`. Two built-in tools claiming the same
 * (phase, gesture, arg, target, modifiers) tuple has no such reading: slot
 * order alone would decide which one fires. So the escalation from "warn" to
 * "throw" lives here rather than at runtime.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas, BUILTIN_TOOL_IDS, type BuiltinToolId } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import type { Feature } from './SceneCanvas/features';
import { WeaselProvider } from '../WeaselProvider';
import { useSelection } from 'core/selection/useSelection';
import { useSceneAdapter } from './sceneAdapter';
import { useSelectTool } from '../tools/builtin/select/useSelectTool';
import { useTools } from '../tools/overlayBinding';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

/** The tool sets the removed `toolBundle` presets named, each under `draw`. */
const TOOL_SETS: Record<string, readonly BuiltinToolId[]> = {
  draw: [],
  'draw + shapes': ['rect', 'ellipse', 'line'],
  'draw + every built-in': BUILTIN_TOOL_IDS,
};

function Harness({ tools }: { tools: readonly BuiltinToolId[] }) {
  const scene = useScene<D, L, P>({
    systemLayers: [{ id: 'main' }],
    initial: [{
      id: asNodeId('a'),
      kind: 'leaf',
      layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50 },
      data: { color: '#f00' },
    }],
  });
  return <SceneCanvas features={['draw']} scene={scene} width={200} height={200} layers={{}} defaultTools={tools} />;
}

describe('built-in tool bundles declare no conflicting routes', () => {
  for (const [name, tools] of Object.entries(TOOL_SETS)) {
    it(`${name} (${tools.join(', ') || 'select, hand'})`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Harness tools={tools} />);
      const conflicts = warn.mock.calls
        .map((args) => String(args[0]))
        .filter((m) => m.includes('route conflict'));
      expect(conflicts).toEqual([]);
    });
  }
});

/**
 * `<SceneCanvas>` assembles its own tools above its `<ActionsProvider>`, so
 * the check `useTools` runs there never sees the registered actions — whose
 * `defaultBinding`s the dispatcher assembles at ambient scope. A consumer's
 * `useTools` under a `<WeaselProvider>` does see them, which is how
 * `MultiSelectDemo` found `resize` and `areaSelect` both claiming a bare drag.
 */
function ConsumerHarness({ features }: { features: readonly Feature[] }) {
  const scene = useScene<D, L, P>({
    systemLayers: [{ id: 'main' }],
    initial: [{
      id: asNodeId('a'),
      kind: 'leaf',
      layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50 },
      data: { color: '#f00' },
    }],
  });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });
  const select = useSelectTool(adapter, {});
  const tools = useTools({ active: 'select', registry: { select } });
  return (
    <SceneCanvas
      features={features}
      scene={scene}
      selection={selection}
      selectionMode="multi"
      tools={tools}
      width={200}
      height={200}
      layers={{}}
    />
  );
}

describe('kit actions a consumer-assembled tool set sees declare no conflicting routes', () => {
  const COMBOS: Record<string, readonly Feature[]> = {
    'pick + move + transform (MultiSelectDemo)': ['pick', 'move', 'transform'],
    'pick + move + transform + edit + arrange': ['pick', 'move', 'transform', 'edit', 'arrange'],
  };
  for (const [name, features] of Object.entries(COMBOS)) {
    it(name, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<WeaselProvider><ConsumerHarness features={features} /></WeaselProvider>);
      const conflicts = warn.mock.calls
        .map((args) => String(args[0]))
        .filter((m) => m.includes('route conflict'));
      expect(conflicts).toEqual([]);
    });
  }
});
