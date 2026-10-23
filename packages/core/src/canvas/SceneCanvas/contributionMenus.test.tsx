/** A `menus` list on an ambient contribution is defined on the surface's menu host. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { ActionsProvider, useMenuHost, useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { MenuHost } from '@weasel-js/routing';
import { SceneCanvas } from '../SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from '../surfaceContribution';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

let host: MenuHost | null | undefined;
let deps: DepRegistry | null = null;
function Probe() {
  const h = useMenuHost();
  const d = useOptionalDepRegistry();
  useEffect(() => { host = h; deps = d; });
  return null;
}

function Harness({ ambient }: { ambient: SurfaceContribution[] }) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  return (
    <ActionsProvider>
      <SceneCanvas scene={scene} layers={{}} width={300} height={200} ambient={ambient}>
        <Probe />
      </SceneCanvas>
    </ActionsProvider>
  );
}

const cut = { id: 'cut', label: 'Cut', invoker: { timing: 'immediate', run: () => {} } };
const contrib = {
  id: 'contrib',
  eligibility: { always: true },
  actions: [cut],
  menus: [{ id: 'contrib.menu', menu: pref.group('', { cut: pref.action('cut') }) }],
} as unknown as SurfaceContribution;

describe('contributed menus', () => {
  it('defines them on the menu host, and publishes the host and worldToClient deps', () => {
    const r = render(<Harness ambient={[contrib]} />);
    expect(host!.open({ menu: 'contrib.menu', client: { x: 0, y: 0 } })).toBe(true);
    expect(deps!.get('menuHost')).toBe(host);
    expect(deps!.get('worldToClient')!(0, 0)).not.toBeUndefined();
    r.unmount();
  });

  it('reach a bare canvas, which makes its own menu host, and open on a right-click', () => {
    const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 10, y: 10, width: 100, height: 100 } });
    const onBody = {
      ...contrib,
      menus: [{ id: 'body', when: { bodyTarget: ['selected-body', 'empty'] }, menu: pref.group('', { cut: pref.action('cut') }) }],
    } as unknown as SurfaceContribution;
    const { container, unmount } = render(
      <SceneCanvas features={['pick', 'edit']} scene={scene} layers={{}} width={300} height={200} ambient={[onBody]}>
        <Probe />
      </SceneCanvas>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    });
    expect(host?.current()?.entries.map((e) => e.kind === 'item' && e.label)).toEqual(['Cut']);
    unmount();
  });
});
