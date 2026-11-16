/**
 * A canvas with no editing layer mounted is a viewer: it draws its scene, pans and zooms, and registers no action that
 * edits or selects.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState } from 'react';
import { useActionsRegistry } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { viewPreset } from 'canvas/SceneCanvas/presets';

const recorder = createGLRecorder();
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

type P = { x: number; y: number; width: number; height: number };

let scene: ReturnType<typeof createScene<object, 'main', P>>;
let mark: NodeId;

function mount() {
  scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  mark = scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 40, height: 40 }, data: {} });
  let actions!: ActionsRegistry;
  const views: View[] = [];
  function Grab() {
    actions = useActionsRegistry()!;
    return null;
  }
  function Host() {
    const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    return (
      <SceneCanvas scene={scene} layers={{}} width={200} height={100} features={[viewPreset]}
        view={view} onViewChange={(v) => { views.push(v); setView(v); }}>
        <Grab />
      </SceneCanvas>
    );
  }
  const { container } = render(<Host />);
  const canvas = container.querySelector('canvas')!;
  const press = (type: string, x: number, y: number, button: number) => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
    button: type === 'pointermove' ? -1 : button,
  }));
  /** Drag 30px right and 20px down with `button` held, starting on the mark. */
  const drag = (button: number) => act(() => {
    press('pointerdown', 30, 30, button);
    press('pointermove', 45, 40, button);
    press('pointermove', 60, 50, button);
    press('pointerup', 60, 50, button);
  });
  return { container, canvas, actions: () => actions, views, drag };
}

describe('a canvas with no editing layer', () => {
  it('draws', async () => {
    const before = recorder.calls.filter((c) => c.name === 'clear').length;
    const { container } = mount();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(recorder.calls.filter((c) => c.name === 'clear').length).toBeGreaterThan(before);
  });

  it('pans on a middle-button drag, even one that starts on a node', () => {
    const { views, drag } = mount();
    drag(1);
    expect(views.at(-1)).toMatchObject({ x: -30, y: -20 });
  });

  it('pans on the wheel', () => {
    const { views, canvas } = mount();
    act(() => { canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })); });
    expect(views.at(-1)?.y ?? 0).toBeGreaterThan(0);
  });

  it('moves nothing on a plain drag of a node, and selects nothing', () => {
    const { views, drag } = mount();
    drag(0);
    expect(views).toEqual([]);
    expect(scene.getSelection()).toEqual([]);
    expect(scene.get(mark)?.pose).toMatchObject({ x: 10, y: 10 });
  });

  it('zooms', () => {
    const { actions, views } = mount();
    act(() => { actions().trigger('viewport.zoom', { kind: 'in' }); });
    expect(views.at(-1)?.scale.x ?? 1).toBeGreaterThan(1);
  });

  it('registers nothing that selects or edits', () => {
    const { actions } = mount();
    const ids = actions().list().map((a) => a.id);
    for (const id of ['delete', 'duplicate', 'move', 'resize', 'rotate', 'areaSelect', 'selectAll', 'group']) {
      expect(ids, id).not.toContain(id);
    }
    expect(ids).toContain('viewport.dragPan');
  });
});
