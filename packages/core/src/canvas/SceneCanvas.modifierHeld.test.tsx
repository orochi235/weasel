/** A `modifierHeld` chrome rule on a `<SceneCanvas>` follows the keyboard. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import type { CanvasHelpers } from './useViewHelpers';
import { createScene } from 'core/scene/scene';
import { useDepRegistry } from '@weasel-js/routing/react';
import type { SelectionApi } from 'core/selection/useSelection';
import { modifierHeld } from 'features/chrome-caps';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

type P = { x: number; y: number; width: number; height: number };

// Without a context that answers like WebGL2 every paint bails before it draws.
const recorder = makeGLRecorder();
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const paints = () => recorder.calls.filter((c) => c.name === 'clear').length;

function Probe({ into }: { into: { selection: SelectionApi | null } }) {
  const deps = useDepRegistry();
  useEffect(() => { into.selection = (deps.get('selection') as SelectionApi | undefined) ?? null; });
  return null;
}

const key = (type: 'keydown' | 'keyup', held: boolean, code = 'ShiftLeft'): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, shiftKey: held, bubbles: true }));
  });
};

describe('<SceneCanvas chromeVisibility> with modifierHeld', () => {
  it('shows the chrome only while the key is down', () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 } });
    const seen: { selection: SelectionApi | null } = { selection: null };
    const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
    render(
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        features={['pick']}
        helpersRef={helpersRef}
        chromeVisibility={{ 'selection.outline': modifierHeld('shift') }}
      >
        <Probe into={seen} />
      </SceneCanvas>,
    );
    act(() => seen.selection!.set([id]));
    const outlined = () => helpersRef.current!.getIsVisible()('selection.outline');

    expect(outlined()).toBe(false);
    key('keydown', true);
    expect(outlined()).toBe(true);
    key('keyup', false);
    expect(outlined()).toBe(false);
  });

  it('paints again when a modifier goes down, and not for another key', async () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    render(<SceneCanvas scene={scene} width={200} height={200} />);
    await frame();
    await frame();
    const before = paints();
    expect(before).toBeGreaterThan(0);

    key('keydown', false, 'KeyA');
    await frame();
    expect(paints()).toBe(before);

    key('keydown', true);
    await frame();
    expect(paints()).toBeGreaterThan(before);
    key('keyup', false);
  });
});
