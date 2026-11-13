/**
 * Every built-in tool `<SceneCanvas>` mounts, walked the way a person uses it:
 * its key makes it the active tool, a gesture runs its action, the action
 * commits, and Ctrl+Z takes the commit back. A tool added to `BUILTIN_TOOL_IDS`
 * with no walk here fails the first test.
 *
 * jsdom's canvas rect is all zeros and the view is identity, so client coords
 * are world coords, and jsdom is not a Mac, so `mod` is Ctrl.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import type { View } from 'core/viewport/view';
import { toolIdsOf } from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { solid } from '../../util/paint';
import { asNodeId, type Scene } from 'core/scene/types';
import type { ToolsApi } from '../overlayBinding';
import { SceneCanvas } from '../../canvas/SceneCanvas';
import { BUILTIN_TOOL_GROUPS, BUILTIN_TOOL_IDS, type BuiltinToolId } from '../../canvas/SceneCanvas/builtinToolSets';

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

/** The tools with no default key, on the maintainer's call (docs/unruled.md, 2026-11-12). */
const KEYLESS: ReadonlySet<string> = new Set(['star']);

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: SQUARE, kind: 'mark', layer: 'main', pose: { x: 100, y: 100, width: 40, height: 40 }, data: { path: square(), fill: { paint: solid('#000000') } } });
  const tools: { current?: ToolsApi } = {};
  const grabbed = {} as { actions: { trigger(id: string): boolean }; deps: { get(k: string): unknown } };
  let view: View | null = null;
  function Grab() {
    const deps = useDepRegistry();
    Object.assign(grabbed, { actions: useActionsRegistry()!, deps });
    return null;
  }
  const { container } = render(
    <SceneCanvas
      features={['draw']} scene={scene} width={400} height={400}
      defaultTools={BUILTIN_TOOL_IDS} defaultActiveTool="select"
      onToolsCreated={(t) => { tools.current = t; }}
      onViewChange={(v) => { view = v; }}
    >
      <Grab />
    </SceneCanvas>,
  );
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
  return { scene, tools: t, activate, drag, click, key, undo, count, trigger, editing, view: () => view };
}

type Walk = ReturnType<typeof mount>;

/** A drag on empty canvas makes one node, and undo takes it away. */
const insertsOnDrag = (w: Walk) => {
  w.drag([240, 240], [280, 270], [330, 320]);
  expect(w.count()).toBe(2);
  w.undo();
  expect(w.count()).toBe(1);
};

const xOf = (scene: Scene<D, 'main', P>) => scene.get(SQUARE)!.pose.x;

const WALKS: Record<BuiltinToolId, (w: Walk) => void> = {
  select: (w) => {
    w.drag([120, 120], [135, 135], [150, 150]);
    expect(xOf(w.scene)).toBe(130);
    w.undo();
    expect(xOf(w.scene)).toBe(100);
  },
  anchors: (w) => {
    expect(w.editing()).toBe(SQUARE);
    const coords = () => Array.from((w.scene.get(SQUARE)!.data.path as { coords: ArrayLike<number> }).coords);
    const before = coords();
    w.drag([140, 100], [145, 95], [150, 90]);
    expect(coords()).not.toEqual(before);
    w.undo();
    expect(coords()).toEqual(before);
  },
  hand: (w) => {
    const depth = w.scene.history.undoDepth();
    w.drag([240, 240], [260, 250], [280, 260]);
    expect(w.view()?.x).not.toBe(0);
    // A pan edits the view, not the document: there is nothing to undo.
    expect(w.scene.history.undoDepth()).toBe(depth);
  },
  rect: insertsOnDrag,
  ellipse: insertsOnDrag,
  line: insertsOnDrag,
  polygon: insertsOnDrag,
  star: insertsOnDrag,
  pencil: insertsOnDrag,
  text: insertsOnDrag,
  sticky: insertsOnDrag,
  pen: (w) => {
    w.click(240, 240);
    w.click(320, 240);
    w.click(320, 320);
    w.key('Enter');
    expect(w.count()).toBe(2);
    w.undo();
    expect(w.count()).toBe(1);
  },
  lasso: (w) => {
    const depth = w.scene.history.undoDepth();
    w.drag([80, 80], [170, 80], [170, 170], [80, 170], [80, 90]);
    expect(w.scene.getSelection()).toEqual([SQUARE]);
    // A selection is not an edit: the lasso commits none to the history.
    expect(w.scene.history.undoDepth()).toBe(depth);
  },
  slice: (w) => {
    w.drag([80, 120], [120, 120], [180, 120]);
    expect(w.count()).toBe(2);
    w.undo();
    expect(w.count()).toBe(1);
  },
};

describe('every built-in tool', () => {
  it('has a walk here, a key or a recorded reason for none, and a place on the palette', () => {
    const w = mount();
    expect(Object.keys(WALKS).sort()).toEqual([...BUILTIN_TOOL_IDS].sort());
    const groupOf = new Map(BUILTIN_TOOL_GROUPS.flatMap((set) => toolIdsOf([set]).map((id) => [id as string, set.id])));
    for (const id of BUILTIN_TOOL_IDS) {
      const tool = w.tools().registry[id]!;
      expect(tool, id).toBeDefined();
      expect(Boolean(tool.keybinding), `${id} key`).toBe(!KEYLESS.has(id));
      expect(tool.presentation?.label, `${id} label`).toBeTruthy();
      expect(tool.presentation?.icon, `${id} glyph`).toBeTruthy();
      expect(tool.presentation?.group, `${id} group`).toBe(groupOf.get(id));
      expect(typeof tool.cursor === 'function' ? tool.cursor() : tool.cursor, `${id} cursor`).toBeTruthy();
    }
  });

  for (const id of BUILTIN_TOOL_IDS) {
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


