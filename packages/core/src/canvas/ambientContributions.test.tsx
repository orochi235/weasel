/** `<AmbientContributionsProvider>` installs its entries on every `<SceneCanvas>` below it. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { ActionsProvider, useMenuHost } from '@weasel-js/routing/react';
import type { MenuHost } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from './surfaceContribution';
import { AmbientContributionsProvider } from './ambientContributions';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

let host: MenuHost | null | undefined;
function Probe() {
  const h = useMenuHost();
  useEffect(() => { host = h; });
  return null;
}

const action = (id: string) => ({ id, label: id, invoker: { timing: 'immediate', run: () => {} } });
const entry = (id: string, menu: string, item: string) => ({
  id,
  eligibility: { always: true },
  actions: [action(item)],
  menus: [{ id: menu, menu: pref.group('', { [item]: pref.action(item) }) }],
}) as unknown as SurfaceContribution;

function Canvas({ ambient = [] }: { ambient?: SurfaceContribution[] }) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  return (
    <SceneCanvas scene={scene} layers={{}} width={300} height={200} ambient={ambient}>
      <Probe />
    </SceneCanvas>
  );
}

const inActions = (node: ReactNode) => render(<ActionsProvider>{node}</ActionsProvider>);
const labels = (menu: string) => {
  host!.open({ menu, client: { x: 0, y: 0 } });
  const items = host!.current()?.entries.flatMap((e) => (e.kind === 'item' ? [e.label] : [])) ?? [];
  host!.close();
  return items;
};

describe('AmbientContributionsProvider', () => {
  it("defines a provided contribution's menus on a canvas below it", () => {
    const r = inActions(
      <AmbientContributionsProvider contributions={[entry('shared', 'shared.menu', 'cut')]}>
        <Canvas />
      </AmbientContributionsProvider>,
    );
    expect(labels('shared.menu')).toEqual(['cut']);
    r.unmount();
  });

  it("lets the canvas's own ambient entry of the same id win", () => {
    const r = inActions(
      <AmbientContributionsProvider contributions={[entry('shared', 'shared.menu', 'cut')]}>
        <Canvas ambient={[entry('shared', 'shared.menu', 'copy')]} />
      </AmbientContributionsProvider>,
    );
    expect(labels('shared.menu')).toEqual(['copy']);
    r.unmount();
  });

  it("lists a provided entry's sections ahead of the canvas's own in a menu both define", () => {
    const r = inActions(
      <AmbientContributionsProvider contributions={[entry('shared', 'shared.menu', 'cut')]}>
        <Canvas ambient={[entry('own', 'shared.menu', 'copy')]} />
      </AmbientContributionsProvider>,
    );
    expect(labels('shared.menu')).toEqual(['cut', 'copy']);
    r.unmount();
  });

  it('accumulates nested providers, the inner one replacing an outer entry of its id', () => {
    const r = inActions(
      <AmbientContributionsProvider contributions={[entry('a', 'a.menu', 'cut'), entry('b', 'b.menu', 'copy')]}>
        <AmbientContributionsProvider contributions={[entry('b', 'b.menu', 'paste')]}>
          <Canvas />
        </AmbientContributionsProvider>
      </AmbientContributionsProvider>,
    );
    expect(labels('a.menu')).toEqual(['cut']);
    expect(labels('b.menu')).toEqual(['paste']);
    r.unmount();
  });
});
