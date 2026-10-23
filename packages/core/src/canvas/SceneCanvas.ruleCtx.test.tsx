/**
 * The rule context `<SceneCanvas>` hands its own dispatcher: none until a mode
 * registry is wired, the active mode's after.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import type { RuleCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { SceneCanvas } from './SceneCanvas';

type P = { x: number; y: number; width: number; height: number };

const seen: { getRuleCtx: (() => RuleCtx | undefined) | undefined } = { getRuleCtx: undefined };

vi.mock('./SceneCanvas/useSceneGestureDispatcher', async (importOriginal) => {
  const real = await importOriginal<typeof import('./SceneCanvas/useSceneGestureDispatcher')>();
  return {
    ...real,
    useSceneGestureDispatcher: (props: Parameters<typeof real.useSceneGestureDispatcher>[0]) => {
      seen.getRuleCtx = props.getRuleCtx;
      real.useSceneGestureDispatcher(props);
    },
  };
});

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

const ID = asNodeId('a');

function mount(props: Record<string, unknown> = {}) {
  const scene = createScene<{ kind: 'rect' }, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.setSelection([ID]);
  return render(<SceneCanvas features={['draw']} scene={scene} width={64} height={64} {...props} />);
}

describe("<SceneCanvas>'s own rule context", () => {
  it('is absent with no mode registry, so the dispatcher filters nothing', () => {
    mount();
    expect(seen.getRuleCtx!()).toBeUndefined();
  });

  it('carries the active mode, the committed selection, and the surface inputs once one is wired', () => {
    const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: DEFAULT_MODES[0].id });
    mount({ modes, getFocused: () => false, selectTool: { resize: { resizable: () => false } } });
    const before = seen.getRuleCtx!;
    expect(before()).toMatchObject({
      mode: DEFAULT_MODES[0].id, selection: [ID], multiActive: false,
      focused: false, selectionResizable: false, editingAnchors: false, zoom: 1,
    });

    const next = DEFAULT_MODES[1];
    act(() => modes.setMode(next.id));
    expect(before()!.mode).toBe(next.id);
  });
});
