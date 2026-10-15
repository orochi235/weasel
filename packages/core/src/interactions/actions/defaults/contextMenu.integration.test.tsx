import { describe, it, expect, vi, beforeAll } from 'vitest';
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

const defs = [{ id: 'sel', when: { bodyTarget: 'selected-body' }, sections: [[{ action: 'delete' }]] }];

function setup() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const ids = {} as Record<'a' | 'b', NodeId>;
  scene.batch('seed', () => {
    ids.a = scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 10, y: 10, width: 50, height: 50 } });
    ids.b = scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 200, y: 100, width: 80, height: 60 } });
  });
  let host: MenuHost | null = null;
  let selection: SelectionApi | null = null;
  function Menus() {
    useMenus(defs as never);
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
          features={['pick', 'edit']} scene={scene} selection={sel} layers={{}} width={400} height={300}
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
  return { ids, rightClick, host: () => host!, selection: () => selection! };
}

describe('menu.context', () => {
  it('selects the shape under a right-click, then opens the menu declared for it', () => {
    const t = setup();
    t.rightClick(240, 130);
    expect(t.selection().get()).toEqual([t.ids.b]);
    expect(t.host().current()?.entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Delete']);
  });
});
