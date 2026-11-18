/**
 * The pen, the pencil, the knife and the anchors tool, walked the way a person uses each: its key
 * makes it the active tool, a gesture runs its action, the action commits, and Ctrl+Z takes the
 * commit back.
 *
 * jsdom's canvas rect is all zeros and the view is identity, so client coords
 * are world coords, and jsdom is not a Mac, so `mod` is Ctrl.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import { toolIdsOf } from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { solid } from '@weasel-js/paint';
import { asNodeId, createScene, SceneCanvas, type ToolsApi } from '@weasel-js/core';
import { pathToolsPreset } from './presets';
import { DRAW_TOOLS, PATH_EDIT_TOOLS, SLICE_TOOLS, usePathToolsTools } from './toolSets';
import { drawPreset } from '@weasel-js/editing';

type D = Record<string, unknown>;
type P = { x: number; y: number; width: number; height: number; rotation?: number };

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

const SQUARE = asNodeId('square');
const square = (): Path => polygonFromPoints([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]);

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: SQUARE, kind: 'mark', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 }, data: { path: square(), fill: { paint: solid('#000000') } } });
  const tools: { current?: ToolsApi } = {};
  const grabbed = {} as { actions: { trigger(id: string): boolean }; deps: { get(k: string): unknown } };
  function Grab() {
    const deps = useDepRegistry();
    Object.assign(grabbed, { actions: useActionsRegistry()!, deps });
    return null;
  }
  function Harness() {
    const own = usePathToolsTools();
    return (
      <SceneCanvas
        features={[drawPreset, pathToolsPreset]} scene={scene} width={400} height={400}
        defaultTools={['select', 'hand']} tools={own} defaultActiveTool="select"
        onToolsCreated={(t) => { tools.current = t; }}
      >
        <Grab />
      </SceneCanvas>
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const key = (k: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, ...init }));
  });
  const pointer = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const drag = (...pts: [number, number][]) => act(() => {
    const [first, ...rest] = pts;
    pointer('pointerdown', ...first!);
    for (const p of rest) pointer('pointermove', ...p);
    pointer('pointerup', ...pts.at(-1)!);
  });
  const click = (x: number, y: number) => act(() => {
    pointer('pointerdown', x, y);
    pointer('pointerup', x, y);
  });
  const t = () => tools.current!;
  /** Make `id` the active tool by its own key, from another tool; a keyless tool is chosen as a palette would. */
  const activate = (id: string) => {
    act(() => t().setActive(id === 'hand' ? 'select' : 'hand'));
    const binding = t().registry[id]!.keybinding;
    if (!binding) {
      act(() => t().setActive(id));
      return;
    }
    const k = typeof binding.key === 'string' ? binding.key : binding.key[0]!;
    key(k, { shiftKey: binding.shift === true, ctrlKey: binding.mod === true, altKey: binding.alt === true });
  };
  const undo = () => key('z', { ctrlKey: true });
  const count = () => [...scene.renderOrder()].length;
  const trigger = (id: string) => act(() => { expect(grabbed.actions.trigger(id), id).toBe(true); });
  const editing = () => (grabbed.deps.get('editAnchors') as { editingId: string | null }).editingId;
  return { scene, tools: t, activate, drag, click, key, undo, count, trigger, editing };
}

type Walk = ReturnType<typeof mount>;

const WALKS: Record<'anchors' | 'pen' | 'pencil' | 'slice', (w: Walk) => void> = {
  anchors: (w) => {
    expect(w.editing()).toBe(SQUARE);
    const coords = () => Array.from((w.scene.get(SQUARE)!.data.path as { coords: ArrayLike<number> }).coords);
    const before = coords();
    w.drag([140, 100], [145, 95], [150, 90]);
    expect(coords()).not.toEqual(before);
    w.undo();
    expect(coords()).toEqual(before);
  },
  pen: (w) => {
    w.click(240, 240);
    w.click(320, 240);
    w.click(320, 320);
    w.key('Enter');
    expect(w.count()).toBe(2);
    w.undo();
    expect(w.count()).toBe(1);
  },
  pencil: (w) => {
    w.drag([240, 240], [280, 270], [330, 320]);
    expect(w.count()).toBe(2);
    w.undo();
    expect(w.count()).toBe(1);
  },
  slice: (w) => {
    w.drag([80, 120], [120, 120], [180, 120]);
    expect(w.count()).toBe(2);
    w.undo();
    expect(w.count()).toBe(1);
  },
};

describe('the path-drawing tools', () => {
  it('each have a key, a label, a glyph, a cursor, and their set\'s palette group', () => {
    const w = mount();
    const groupOf = new Map([PATH_EDIT_TOOLS, DRAW_TOOLS, SLICE_TOOLS].flatMap((set) => toolIdsOf([set]).map((id) => [id as string, set.id])));
    for (const id of Object.keys(WALKS)) {
      const tool = w.tools().registry[id]!;
      expect(tool, id).toBeDefined();
      expect(Boolean(tool.keybinding), `${id} key`).toBe(true);
      expect(tool.presentation?.label, `${id} label`).toBeTruthy();
      expect(tool.presentation?.icon, `${id} glyph`).toBeTruthy();
      expect(typeof tool.cursor === 'function' ? tool.cursor() : tool.cursor, `${id} cursor`).toBeTruthy();
      expect(tool.presentation?.group, `${id} group`).toBe(groupOf.get(id));
    }
  });

  for (const id of Object.keys(WALKS) as (keyof typeof WALKS)[]) {
    it(`${id}: activates by its key, commits through its action, and undoes`, () => {
      const w = mount();
      if (id === 'anchors') {
        // Anchor editing works on the path path edit was entered on.
        act(() => { w.scene.setSelection([SQUARE]); });
        w.trigger('enterPathEdit');
      }
      w.activate(id);
      expect(w.tools().active).toBe(id);
      WALKS[id](w);
    });
  }
});
