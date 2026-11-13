/**
 * `<SceneCanvas>`'s own text editor: a placed text node can be typed into with
 * no host wiring, and the editor stands down for a host's own.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { useSceneTextEdit } from 'domains/text/useSceneTextEdit';
import { SceneCanvas } from './SceneCanvas';
import type { Feature } from './SceneCanvas/features';
import { layersWhileEditing, useCanvasTextEditor, type SceneCanvasTextEditor } from './SceneCanvas/defaultTextEditor';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';

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

function mount(opts: { features?: Feature[]; textEditor?: SceneCanvasTextEditor<D>; host?: boolean } = {}) {
  const scene = sceneWithText();
  function Host() {
    const [frame, setFrame] = useState<HTMLDivElement | null>(null);
    const edit = useSceneTextEdit(scene, opts.host ? frame : null);
    hostEditing = () => edit.editingId;
    return (
      <div ref={setFrame} data-testid="frame">
        <SceneCanvas scene={scene} width={300} height={60} features={opts.features ?? ['edit']}
          {...(opts.textEditor !== undefined ? { textEditor: opts.textEditor } : {})}>
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

describe("SceneCanvas's own text editor", () => {
  it('opens on a double-click on a text node, seeded with its text', () => {
    const t = mount();
    t.doubleClick();
    expect(t.overlays()).toHaveLength(1);
    expect(t.overlays()[0]!.textContent).toBe('hello');
  });

  it("answers the textEdit dep, which a text tool's enterTextEdit calls", () => {
    const t = mount({ features: [] });
    act(() => startEdit!('t'));
    expect(t.overlays()).toHaveLength(1);
  });

  it('opens on no double-click without the edit feature', () => {
    const t = mount({ features: [] });
    t.doubleClick();
    expect(t.overlays()).toHaveLength(0);
  });

  it('mounts nowhere under textEditor={false}', () => {
    const t = mount({ textEditor: false });
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

  it("leaves out the glyphs of the node a host's editor has open", () => {
    const scene = sceneWithText();
    const container = document.createElement('div');
    const element = container.appendChild(document.createElement('canvas'));
    document.body.appendChild(container);
    const host = renderHook(() => useSceneTextEdit(scene, container));
    const canvas = renderHook(() => useCanvasTextEditor(scene, { current: element }, { textEditor: false }));
    const node = scene.get(asNodeId('t'))!;
    const drawn = () => {
      const slot = canvas.result.current.layers?.scene as { drawOne: typeof defaultDrawOne } | undefined;
      return (slot?.drawOne ?? defaultDrawOne)(node, node.pose).map((c) => c.kind);
    };
    expect(drawn()).toContain('text');
    act(() => host.result.current.startEdit('t'));
    expect(drawn()).not.toContain('text');
    act(() => host.result.current.cancelEdit());
    expect(drawn()).toContain('text');
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

describe('layersWhileEditing', () => {
  const node = sceneWithText().get(asNodeId('t'))!;
  const kinds = (cmds: readonly { kind: string }[]) => cmds.map((c) => c.kind);

  it('is the layers given while nothing is edited', () => {
    const layers = { scene: { drawOne: defaultDrawOne } };
    expect(layersWhileEditing(layers, null)).toBe(layers);
  });

  it("leaves out the edited node's glyphs, keeping the default paint bounds", () => {
    const scene = layersWhileEditing<D, 'main', P>(undefined, 't')!.scene as { drawOne: typeof defaultDrawOne; paintBounds: unknown };
    expect(kinds(defaultDrawOne(node, node.pose))).toContain('text');
    expect(kinds(scene.drawOne(node, node.pose))).not.toContain('text');
    expect(scene.paintBounds).toBe(defaultPaintBounds);
  });

  it("wraps a host's drawOne, and leaves a custom layer entry alone", () => {
    const own = vi.fn(() => [{ kind: 'text' } as never]);
    const scene = layersWhileEditing<D, 'main', P>({ scene: { drawOne: own } }, 't')!.scene as { drawOne: typeof defaultDrawOne };
    expect(scene.drawOne(node, node.pose)).toEqual([]);
    const custom = { scene: { layer: {} as never } };
    expect(layersWhileEditing(custom as never, 't')).toBe(custom);
  });
});
