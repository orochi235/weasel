/**
 * `<SceneCanvas>`'s own text editor: a placed text node can be typed into with
 * no host wiring, and the editor stands down for a host's own.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { useSceneTextEdit } from 'domains/text/useSceneTextEdit';
import { SceneCanvas } from './SceneCanvas';
import type { Feature } from './SceneCanvas/features';
import { layersWhileEditing, type SceneCanvasTextEditor } from './SceneCanvas/defaultTextEditor';
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
      <div ref={setFrame} data-testid="frame" onDoubleClick={opts.host ? edit.onDoubleClick : undefined}>
        <SceneCanvas scene={scene} width={300} height={60} features={opts.features ?? ['edit']}
          {...(opts.textEditor !== undefined ? { textEditor: opts.textEditor } : {})}>
          <StartEdit />
        </SceneCanvas>
      </div>
    );
  }
  const frame = render(<Host />).getByTestId('frame');
  const canvas = frame.querySelector('canvas')!;
  const doubleClick = () => act(() => {
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 20, clientY: 20 }));
  });
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

  it("stands down for a host's useSceneTextEdit over the canvas", () => {
    const t = mount({ host: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    t.doubleClick();
    expect(t.overlays()).toHaveLength(1);
    expect(hostEditing()).toBe('t');
    // A second editor opening would take focus and end the host's edit.
    act(() => startEdit!('t'));
    expect(hostEditing()).toBe('t');
    warn.mockRestore();
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
