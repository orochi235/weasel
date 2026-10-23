import { describe, it, expect, vi, beforeAll } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { render, act } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { ActionsProvider, useMenuHost, useMenus } from '@weasel-js/routing/react';
import type { MenuHost } from '@weasel-js/routing';
import { SceneCanvas } from '../../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

type D = { kind: string };
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

const defs = [{ id: 'sel', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { delete: pref.action('delete') }) }];

const clicked = vi.fn();
const clickProbe = {
  id: 'click-probe',
  eligibility: { always: true },
  actions: [{ id: 'test.click', label: 'click', invoker: { timing: 'immediate', run: () => { clicked(); } } }],
  bindings: [{ spec: { kind: 'click' }, actionId: 'test.click' }],
};

type Seed = (scene: ReturnType<typeof createScene<D, 'main', P>>) => void;

function setup(declare = true, menus: unknown[] = defs, seed?: Seed, pickEvery?: (x: number, y: number) => string[]) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const ids = {} as Record<'a' | 'b', NodeId>;
  scene.batch('seed', () => {
    ids.a = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 10, y: 10, width: 50, height: 50 } });
    ids.b = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 200, y: 100, width: 80, height: 60 } });
    seed?.(scene);
  });
  let host: MenuHost | null = null;
  let selection: SelectionApi | null = null;
  function Menus() {
    useMenus((declare ? menus : []) as never);
    const h = useMenuHost();
    useEffect(() => { host = h; });
    return null;
  }
  function Harness() {
    const sel = useSelection({ scene, mode: 'single' });
    selection = sel;
    const seeded = useRef(false);
    useEffect(() => {
      if (seeded.current) return;
      seeded.current = true;
      sel.set([ids.a]);
    }, [sel]);
    return (
      <ActionsProvider>
        <SceneCanvas
          features={['pick', 'edit']} claimKeys scene={scene} selection={sel} layers={{}} width={400} height={300}
          ambient={[clickProbe as never]}
          {...(pickEvery ? { geometry: { pickEvery } } : {})}
          routing={[{ name: 'rect', matches: (d: unknown) => (d as D).kind === 'rect' }]}
        >
          <Menus />
        </SceneCanvas>
      </ActionsProvider>
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const rightClick = (x: number, y: number) => act(() => {
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  });
  const touchTap = (x: number, y: number, holdMs: number) => {
    const init = { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y };
    act(() => { canvas.dispatchEvent(new PointerEvent('pointerdown', { ...init, button: 0, buttons: 1 })); });
    act(() => { vi.advanceTimersByTime(holdMs); });
    act(() => { canvas.dispatchEvent(new PointerEvent('pointerup', init)); });
  };
  const shiftF10 = () => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', code: 'F10', shiftKey: true, bubbles: true }));
  });
  return { scene, ids, rightClick, touchTap, shiftF10, host: () => host!, selection: () => selection! };
}

describe('menu.context', () => {
  it('selects the shape under a right-click, then opens the menu declared for it', () => {
    const t = setup();
    t.rightClick(240, 130);
    expect(t.selection().get()).toEqual([t.ids.b]);
    expect(t.host().current()?.entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Delete']);
  });

  it("selects the group of the node the dispatcher classified, not the last one the picker walked", () => {
    let box = '' as NodeId;
    let child = '' as NodeId;
    // The picker lists the container last; the classifier collapses a parent
    // under its own child, so the two disagree about what is on top.
    const pickEvery = (x: number, y: number) => (x >= 20 && x <= 100 && y >= 200 && y <= 280 ? [child, box] : []);
    const t = setup(true, defs, (scene) => {
      box = scene.add({ kind: 'group', data: { kind: 'group' }, layer: 'main', pose: { x: 20, y: 200, width: 80, height: 80 } });
      child = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', parent: box, pose: { x: 40, y: 220, width: 30, height: 30 } });
    }, pickEvery);
    t.rightClick(55, 235);
    expect(t.selection().get()).toEqual([box]);
    expect(t.host().current()).not.toBeNull();
  });

  it('leaves the selection alone on a right-click when no menu is declared', () => {
    const t = setup(false);
    t.rightClick(240, 130);
    expect(t.selection().get()).toEqual([t.ids.a]);
    expect(t.host().current()).toBeNull();
  });

  it('lets a long-press with no menu to open fall through to the click', () => {
    vi.useFakeTimers();
    try {
      const t = setup(false);
      clicked.mockClear();
      t.touchTap(240, 130, 600);
      expect(clicked).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  const rectMenu = [{
    id: 'rect', when: { bodyTarget: 'selected-body', bodyKind: 'rect' }, menu: pref.group('', { delete: pref.action('delete') }),
  }];

  it('opens a menu declared for a routing kind, not the structural node kind', () => {
    const t = setup(true, rectMenu);
    t.rightClick(240, 130);
    expect(t.host().current()?.entries).toHaveLength(1);
  });

  it('answers has() as open() does, for a match and a miss', () => {
    const t = setup(true, rectMenu);
    const req = (bodyKind: string) => ({ hit: { bodyTarget: 'selected-body' as const, bodyKind }, client: { x: 0, y: 0 } });
    expect(t.host().has(req('rect'))).toBe(true);
    expect(t.host().has(req('text'))).toBe(false);
    t.rightClick(240, 130);
    expect(t.host().current()).not.toBeNull();
    t.host().close();
    t.rightClick(380, 280);
    expect(t.host().current()).toBeNull();
  });

  it('opens the menu for the selected shape on Shift+F10', () => {
    const t = setup(true, rectMenu);
    t.shiftF10();
    expect(t.host().current()).toMatchObject({ source: 'keyboard' });
    expect(t.host().current()?.entries).toHaveLength(1);
  });

  it('resolves and runs a row from the canvas scope with no dep registry above the provider', () => {
    const dup = [{ id: 'dup', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { duplicate: pref.action('duplicate') }) }];
    const t = setup(true, dup);
    t.rightClick(240, 130);
    const row = t.host().current()?.entries[0];
    expect(row).toMatchObject({ kind: 'item', label: 'Duplicate', disabled: false });
    act(() => { if (row?.kind === 'item') row.run(); });
    expect(t.scene.nodes.size).toBe(3);
  });
});
