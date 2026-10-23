/**
 * Default-keybindings matrix: every kit-standard keystroke reaches the action
 * it's bound to under a default `<SceneCanvas>` mount. Break a default key and
 * exactly one matrix row fails.
 *
 * jsdom isn't Mac, so `mod: true` in default bindings resolves to
 * `ctrlKey` — the tests fire `ctrlKey: true` accordingly.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, BUILTIN_TOOL_IDS } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { ActiveToolContextProvider, useActiveToolContext } from '@weasel-js/routing/react';

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
    s.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L, pose: { x: 0, y: 0, width: 10, height: 10 } as P });
  });
  return s;
}

// --- Tool-activation matrix ------------------------------------------------

interface ToolKeyCase {
  readonly toolId: string;
  readonly key: string;
  readonly label: string;
}

// Mirrors the `keybinding` each built-in tool's definition declares. If a key
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
// `actions` prop is processed, which makes a spy on its invoker unreliable
// here. So we lift our own active-tool provider above SceneCanvas and read
// the context from a sibling.
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
      // Start on something OTHER than the target so the keystroke causes an
      // observable transition.
      const initial = toolId === 'select' ? 'hand' : 'select';
      render(
        <ActiveToolContextProvider initialActive={initial}>
          <ActiveTap tapRef={tap} />
          <SceneCanvas features={['draw']}
            scene={scene}
            layers={{}}
            width={64}
            height={64}
            defaultTools={BUILTIN_TOOL_IDS}
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
  { actionId: 'transformAgain', key: 'd', mods: { ctrlKey: true },             label: 'Cmd/Ctrl+D → transformAgain' },
  { actionId: 'duplicate', key: 'd', mods: { ctrlKey: true, shiftKey: true },  label: 'Cmd/Ctrl+Shift+D → duplicate' },
  { actionId: 'group',     key: 'g', mods: { ctrlKey: true },                  label: 'Cmd/Ctrl+G → group' },
  { actionId: 'ungroup',   key: 'g', mods: { ctrlKey: true, shiftKey: true },  label: 'Cmd/Ctrl+Shift+G → ungroup' },
  { actionId: 'escape',    key: 'Escape',                                      label: 'Escape → escape' },
];

describe('default keybindings: action shortcuts', () => {
  for (const { actionId, key, mods, label } of ACTION_KEY_MATRIX) {
    it(label, () => {
      const scene = makeScene();
      const run = vi.fn();
      render(
        <SceneCanvas features={['draw']}
          scene={scene}
          layers={{}}
          width={64}
          height={64}
          actions={{
            [actionId]: {
              // `enabled: () => true` defeats any precondition gate: the
              // matrix is checking dispatch, not gating.
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
