/**
 * The canvas's own text editor, as `textPreset` mounts it: a placed text node
 * can be typed into with no host wiring, and the editor stands down for a
 * host's own.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';
import { useSceneTextEdit } from './useSceneTextEdit';
import type { CanvasTextEditorOptions } from './canvasEditor';
import { asNodeId, createScene, SceneCanvas, type FeaturePreset } from '@weasel-js/core';
import { paintStandInsOver } from 'canvas/paintStandIns';
import { createTextPreset, textPreset } from '../presets';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

type D = { text: string };
type P = { x: number; y: number; width: number; height: number };

function sceneWithText() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 200, height: 40 }, data: { text: 'hello' } } as never);
  return scene;
}

let startEdit: ((id: string) => void) | null = null;
let hostEditing: () => string | null = () => null;
function StartEdit(): null {
  const registry = useDepRegistry();
  startEdit = (id) => registry.get('textEdit')?.startEdit(id);
  return null;
}

function mount(opts: { features?: FeaturePreset[]; editor?: CanvasTextEditorOptions; host?: boolean } = {}) {
  const scene = sceneWithText();
  function Host() {
    const [frame, setFrame] = useState<HTMLDivElement | null>(null);
    const edit = useSceneTextEdit(scene, opts.host ? frame : null);
    hostEditing = () => edit.editingId;
    return (
      <div ref={setFrame} data-testid="frame">
        <SceneCanvas scene={scene} width={300} height={60}
          features={opts.features ?? [opts.editor !== undefined ? createTextPreset({ editor: opts.editor }) : textPreset]}>
          <StartEdit />
        </SceneCanvas>
      </div>
    );
  }
  const frame = render(<Host />).getByTestId('frame');
  const canvas = frame.querySelector('canvas')!;
  const press = (type: string) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 20, clientY: 20, pointerId: 1, button: 0, buttons: 1 }));
  const doubleClick = () => act(() => { press('pointerdown'); press('pointerup'); press('pointerdown'); press('pointerup'); });
  const overlays = () => frame.querySelectorAll('[contenteditable="true"]');
  return { scene, doubleClick, overlays };
}

describe("the canvas's own text editor", () => {
  it('opens on a double-click on a text node, seeded with its text', () => {
    const t = mount();
    t.doubleClick();
    expect(t.overlays()).toHaveLength(1);
    expect(t.overlays()[0]!.textContent).toBe('hello');
  });

  it("answers the textEdit dep, which a text tool's enterTextEdit calls", () => {
    const t = mount();
    act(() => startEdit!('t'));
    expect(t.overlays()).toHaveLength(1);
  });

  it('opens on no double-click, and answers no textEdit dep, without the text preset', () => {
    const t = mount({ features: [] });
    t.doubleClick();
    act(() => startEdit!('t'));
    expect(t.overlays()).toHaveLength(0);
  });

  it('mounts nowhere under editor: false', () => {
    const t = mount({ editor: false });
    t.doubleClick();
    act(() => startEdit!('t'));
    expect(t.overlays()).toHaveLength(0);
  });

  it("stands down for a host's useSceneTextEdit over the canvas, answering the textEdit dep with it", () => {
    const t = mount({ host: true });
    t.doubleClick();
    expect(t.overlays()).toHaveLength(1);
    expect(hostEditing()).toBe('t');
    // A second editor opening would take focus and end the host's edit.
    act(() => startEdit!('t'));
    expect(hostEditing()).toBe('t');
    expect(t.overlays()).toHaveLength(1);
  });

  it("stands in for the glyphs of the node a host's editor has open", () => {
    const scene = sceneWithText();
    const container = document.createElement('div');
    const element = container.appendChild(document.createElement('canvas'));
    document.body.appendChild(container);
    const host = renderHook(() => useSceneTextEdit(scene, container));
    expect(paintStandInsOver(element, scene).has('t')).toBe(false);
    act(() => host.result.current.startEdit('t'));
    const keep = paintStandInsOver(element, scene).get('t')!;
    expect(keep([{ kind: 'text' } as never, { kind: 'path' } as never]).map((c) => c.kind)).toEqual(['path']);
    act(() => host.result.current.cancelEdit());
    expect(paintStandInsOver(element, scene).has('t')).toBe(false);
    container.remove();
  });

  it('commits what was typed as the node text', () => {
    const t = mount();
    t.doubleClick();
    const el = t.overlays()[0] as HTMLElement;
    el.textContent = 'bye';
    act(() => { el.dispatchEvent(new FocusEvent('blur')); });
    expect((t.scene.get(asNodeId('t'))!.data as D).text).toBe('bye');
  });
});
