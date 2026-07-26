/**
 * Default-keybindings matrix.
 *
 * Single happy-path proof that every kit-standard keystroke reaches the
 * action it's bound to under a default `<SceneCanvas>` mount. Each
 * individual binding has narrower coverage scattered across other suites
 * (useKeybindings registration tests, per-action behavior tests,
 * SceneCanvas.actions.behavior, etc.). What this file adds is one place
 * to look — break a default key, exactly one matrix row fails.
 *
 * Two halves:
 *
 * 1. **Tool-activation keys** (`tool.activate`) — mounted via
 *    `toolBundle="exhaustive"` so every built-in tool is in the registry.
 *    Spy the `tool.activate` invoker; assert each tool's key fires it
 *    with the right `toolId`.
 *
 * 2. **Action keys** (Cmd/Ctrl combos + bare Escape) — each shadowed
 *    with a spy `invoker.run` via the `actions` override prop; assert
 *    one dispatch per key.
 *
 * jsdom isn't Mac, so `mod: true` in default bindings resolves to
 * `ctrlKey` — the tests fire `ctrlKey: true` accordingly.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { ActiveToolContextProvider, useActiveToolContext } from 'interactions/actions/activeToolContext';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L, pose: { x: 0, y: 0, width: 10, height: 10 } as P });
  });
  return s;
}

// --- Tool-activation matrix ------------------------------------------------

interface ToolKeyCase {
  readonly toolId: string;
  readonly key: string;
  readonly label: string;
}

// Mirrors BUILTIN_SELECT_KEYS in src/tools/useKeybindings.ts. If a key
// moves there, this row fails — that's the point.
const TOOL_KEY_MATRIX: readonly ToolKeyCase[] = [
  { toolId: 'select',  key: 'V',  label: 'V → select' },
  { toolId: 'rect',    key: 'R',  label: 'R → rect' },
  { toolId: 'ellipse', key: 'E',  label: 'E → ellipse' },
  { toolId: 'line',    key: '\\', label: '\\ → line' },
  { toolId: 'polygon', key: 'G',  label: 'G → polygon' },
  { toolId: 'pencil',  key: 'N',  label: 'N → pencil' },
  { toolId: 'text',    key: 'T',  label: 'T → text' },
  { toolId: 'hand',    key: 'H',  label: 'H → hand' },
  { toolId: 'pen',     key: 'P',  label: 'P → pen' },
];

// `useKeybindings` registers `tool.activate` after the consumer-supplied
// `actions` prop is processed, which makes a spy on `tool.activate`'s
// invoker unreliable here. The observable end-state is what matters: the
// active-tool context updates. We lift our own provider above SceneCanvas
// (the `IfRoot` variant inside is a no-op when one is already present)
// and peek at it from a sibling consumer.
function ActiveTap({ tapRef }: { tapRef: { current: string | null } }) {
  const ctx = useActiveToolContext();
  tapRef.current = ctx.active;
  return null;
}

describe('default keybindings: tool activation', () => {
  for (const { toolId, key, label } of TOOL_KEY_MATRIX) {
    it(label, () => {
      const scene = makeScene();
      const tap: { current: string | null } = { current: null };
      // Initial active starts at something OTHER than the target so the
      // keystroke causes an observable transition (vs. confirming we
      // started in the right state by coincidence).
      const initial = toolId === 'select' ? 'hand' : 'select';
      render(
        <ActiveToolContextProvider initialActive={initial}>
          <ActiveTap tapRef={tap} />
          <SceneCanvas
            scene={scene}
            layers={{}}
            width={64}
            height={64}
            toolBundle="exhaustive"
            // Hand is only registered when the viewport feature is on
            // (its `H` key activate + space hold both route through the
            // registry); an empty viewport prop is enough to flip the
            // gate without changing the matrix's behavior.
            viewport={{}}
          />
        </ActiveToolContextProvider>,
      );
      expect(tap.current).toBe(initial);
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
      expect(tap.current).toBe(toolId);
    });
  }
});

// --- Action-key matrix -----------------------------------------------------

interface ActionKeyCase {
  readonly actionId: string;
  readonly key: string;
  readonly mods?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean };
  readonly label: string;
}

// Each row asserts: a single keydown invokes exactly one action's run.
// `mod` in the default bindings resolves to ctrlKey in jsdom (non-Mac).
const ACTION_KEY_MATRIX: readonly ActionKeyCase[] = [
  { actionId: 'selectAll', key: 'a', mods: { ctrlKey: true },                  label: 'Cmd/Ctrl+A → selectAll' },
  { actionId: 'undo',      key: 'z', mods: { ctrlKey: true },                  label: 'Cmd/Ctrl+Z → undo' },
  { actionId: 'redo',      key: 'z', mods: { ctrlKey: true, shiftKey: true },  label: 'Cmd/Ctrl+Shift+Z → redo' },
  { actionId: 'duplicate', key: 'd', mods: { ctrlKey: true },                  label: 'Cmd/Ctrl+D → duplicate' },
  { actionId: 'group',     key: 'g', mods: { ctrlKey: true },                  label: 'Cmd/Ctrl+G → group' },
  { actionId: 'ungroup',   key: 'g', mods: { ctrlKey: true, shiftKey: true },  label: 'Cmd/Ctrl+Shift+G → ungroup' },
];

describe('default keybindings: action shortcuts', () => {
  for (const { actionId, key, mods, label } of ACTION_KEY_MATRIX) {
    it(label, () => {
      const scene = makeScene();
      const run = vi.fn();
      render(
        <SceneCanvas
          scene={scene}
          layers={{}}
          width={64}
          height={64}
          actions={{
            [actionId]: {
              // `enabled: () => true` defeats any precondition gate the
              // default action might have (e.g. requires non-empty
              // selection). The matrix is checking dispatch, not gating.
              invoker: { timing: 'immediate' as const, run: () => { run(); } },
              enabled: () => true,
            },
          }}
        />,
      );
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods })); });
      expect(run).toHaveBeenCalledOnce();
    });
  }
});

// --- Escape: dispatched by multiple actions; just prove the key isn't
// dead. The action that wins is gated on context (cancelGesture if a
// gesture is in flight, exitPathEdit in path-edit mode, escape otherwise).
describe('default keybindings: Escape is reachable', () => {
  it('Escape dispatches to the escape action when no gesture or path-edit context is active', () => {
    const scene = makeScene();
    const run = vi.fn();
    render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={64}
        height={64}
        actions={{
          escape: {
            invoker: { timing: 'immediate' as const, run: () => { run(); } },
            enabled: () => true,
          },
        }}
      />,
    );
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(run).toHaveBeenCalledOnce();
  });
});
