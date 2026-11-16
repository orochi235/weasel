/**
 * A canvas with no editing layer mounted is a viewer: it draws its scene and zooms, keeps drag-pan, and registers no
 * action that edits or selects.
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

function mount() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 40, height: 40 }, data: {} });
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
  return { container, actions: () => actions, views };
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
