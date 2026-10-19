/**
 * Hold O and turn the wheel: the scrub tool engages at hotkey scope, so the
 * wheel reaches its nudge action and not the viewport's pan/zoom bindings.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider,
  SceneCanvas,
  asNodeId,
  inferredNodeProperties,
  paintAlpha,
  solid,
  useScene,
  useSelection,
  type View,
  type Fill,
} from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { WD_RENDERERS } from '../paintRenderers';
import { useOpacityScrub } from './useOpacityScrub';
import { withIcons } from '../testIcons';

type D = { fill?: Fill | null; text?: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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
afterEach(() => cleanup());

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const ID = asNodeId('a');
// The fixture has no `path`, so classify it as one outright to get draw's schema.
const PANEL_ROUTING = [{ name: 'path', matches: () => true }];

function setup({ selected = true, data = { fill: { paint: solid('#ff0000') } } as D } = {}) {
  const onViewChange = vi.fn();
  let api!: {
    scene: ReturnType<typeof useScene<D, L, P>>;
    percent: number | null;
  };
  function Harness() {
    const scene = useScene<D, L, P>({
      systemLayers: [{ id: 'main' }],
      initial: [{
        id: ID, kind: 'leaf', layer: 'main',
        pose: { x: 0, y: 0, width: 50, height: 50 },
        data,
      }],
    });
    const selection = useSelection({ mode: 'multi', scene, initial: selected ? [ID] : [] });
    const { tool, percent } = useOpacityScrub({
      scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
      selection,
    });
    api = { scene, percent };
    return (
      <ActionsProvider>
      <SelectionPanel
        scene={scene}
        selection={selection}
        properties={inferredNodeProperties}
        routing={PANEL_ROUTING}
        renderers={WD_RENDERERS}
      />
      <SceneCanvas features={['draw']}
        scene={scene}
        selection={selection}
        width={200} height={200}
        layers={{}}
        view={HOME}
        onViewChange={onViewChange}
        tools={{ opacityScrub: tool }}
      />
      </ActionsProvider>
    );
  }
  const { container, getByRole } = render(<Harness />, { wrapper: withIcons });
  const fillSlider = () => (getByRole('slider', { name: 'Fill opacity' }) as HTMLInputElement).value;
  const canvas = container.querySelector('canvas')!;
  const wheel = (init: WheelEventInit = {}) => act(() => {
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true, ...init }));
  });
  const key = (type: 'keydown' | 'keyup') => act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: 'o', code: 'KeyO' }));
  });
  const alpha = () => {
    const fill = (api.scene.get(ID)!.data as D).fill;
    return Math.round(paintAlpha(fill!.paint) * 100);
  };
  return { onViewChange, wheel, key, alpha, fillSlider, api: () => api };
}

describe('opacity scrub', () => {
  it('scrubs the selection while O is held, without moving the view', () => {
    const t = setup();
    t.key('keydown');
    expect(t.api().percent).toBe(100);
    t.wheel();
    t.wheel();
    expect(t.alpha()).toBe(90);
    expect(t.api().percent).toBe(90);
    t.wheel({ shiftKey: true });
    expect(t.alpha()).toBe(89);
    expect(t.onViewChange).not.toHaveBeenCalled();
  });

  it("moves the Properties panel's fill opacity with every tick", () => {
    const t = setup();
    expect(t.fillSlider()).toBe('100');
    t.key('keydown');
    t.wheel();
    expect(t.fillSlider()).toBe('95');
    t.wheel();
    expect(t.fillSlider()).toBe('90');
    t.key('keyup');
    expect(t.fillSlider()).toBe('90');
  });

  it('commits the session as one undo entry on release, and the wheel pans again', () => {
    const t = setup();
    const before = t.api().scene.historyIndex();
    t.key('keydown');
    t.wheel();
    t.wheel();
    t.key('keyup');
    expect(t.api().percent).toBe(null);
    expect(t.api().scene.historyIndex()).toBe(before + 1);

    t.wheel();
    expect(t.onViewChange).toHaveBeenCalled();
    expect(t.alpha()).toBe(90);

    act(() => t.api().scene.undo());
    expect(t.alpha()).toBe(100);
  });

  it('commits when the window loses focus mid-hold', () => {
    const t = setup();
    const before = t.api().scene.historyIndex();
    t.key('keydown');
    t.wheel();
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(t.api().percent).toBe(null);
    expect(t.api().scene.historyIndex()).toBe(before + 1);
  });

  it('scrubs text that paints by default from the black it shows', () => {
    const t = setup({ data: { text: 'hi' } });
    t.key('keydown');
    expect(t.api().percent).toBe(100);
    t.wheel();
    expect((t.api().scene.get(ID)!.data as D).fill).toMatchObject({ paint: { color: '#000', opacity: 0.95 } });
    expect('stroke' in (t.api().scene.get(ID)!.data as object)).toBe(false);
  });

  it('opens no session over a node with no paint to scale', () => {
    const t = setup({ data: {} });
    t.key('keydown');
    expect(t.api().percent).toBe(null);
    t.wheel();
    expect(t.api().scene.get(ID)!.data).toEqual({});
  });

  it('opens no session with nothing selected, and leaves the wheel to the viewport', () => {
    const t = setup({ selected: false });
    t.key('keydown');
    expect(t.api().percent).toBe(null);
    t.wheel();
    expect(t.onViewChange).toHaveBeenCalled();
    expect(t.alpha()).toBe(100);
  });

  it('keeps an edit made between two wheel turns, and its place in the undo stack', () => {
    const t = setup();
    t.key('keydown');
    t.wheel();
    const scene = t.api().scene;
    act(() => scene.setPose(ID, { x: 7, y: 0, width: 50, height: 50 }));
    t.wheel();
    expect(scene.get(ID)!.pose.x).toBe(7);
    expect(t.alpha()).toBe(90);
    t.key('keyup');
    // Undo walks back through the second turn, the move, then the first turn.
    act(() => scene.undo());
    expect(t.alpha()).toBe(95);
    expect(scene.get(ID)!.pose.x).toBe(7);
    act(() => scene.undo());
    expect(scene.get(ID)!.pose.x).toBe(0);
    act(() => scene.undo());
    expect(t.alpha()).toBe(100);
  });

  it('still leaves one entry for a run of turns nothing interrupts', () => {
    const t = setup();
    t.key('keydown');
    t.wheel();
    t.wheel();
    t.wheel();
    t.key('keyup');
    expect(t.alpha()).toBe(85);
    act(() => t.api().scene.undo());
    expect(t.alpha()).toBe(100);
  });
});
