/** An entry's `watch` is how its thunk deps say they changed, so chrome showing its actions re-reads. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { ActionsProvider, useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
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

let deps: DepRegistry | null = null;
function Probe() {
  const d = useOptionalDepRegistry();
  useEffect(() => { deps = d; });
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

describe("an entry's watch", () => {
  it('tells the dep registry when the entry says its sources changed, and stops once it leaves', () => {
    let changed: (() => void) | undefined;
    const stop = vi.fn();
    const watch = vi.fn((c: () => void) => {
      changed = c;
      return stop;
    });
    const entry = { id: 'app', eligibility: { always: true }, deps: {}, watch } as unknown as SurfaceContribution;
    const view = render(<Harness ambient={[entry]} />);
    expect(watch).toHaveBeenCalledTimes(1);

    const heard = vi.fn();
    const unsubscribe = deps!.subscribe!(heard);
    act(() => changed!());
    expect(heard).toHaveBeenCalled();
    unsubscribe();

    view.rerender(<Harness ambient={[]} />);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
