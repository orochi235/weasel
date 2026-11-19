/**
 * A preset's components keep their state while other presets come and go, and a dep one publishes sits over the
 * canvas's own and under its children's, whenever it mounted.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { useDepRegistry, useDepSource, type DepName } from '@weasel-js/routing/react';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { SceneCanvas } from '../SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { FeaturePreset } from './features';

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const PROBE = 'presetComponentsProbe' as DepName;
const scene = createScene<{ kind: 'rect' }, 'main', unknown>({ systemLayers: [{ id: 'main' }] });

function Canvas({ features, children }: { features: FeaturePreset[]; children?: ReactNode }) {
  return <SceneCanvas scene={scene} layers={{}} width={100} height={100} features={features}>{children}</SceneCanvas>;
}

describe('PresetComponents', () => {
  it('keeps a component mounted when a preset ahead of it turns off', () => {
    const mounts: string[] = [];
    const part = (id: string) => function Part() {
      useEffect(() => { mounts.push(id); }, []);
      return null;
    };
    const a: FeaturePreset = { id: 'a', components: [part('a')] };
    const b: FeaturePreset = { id: 'b', components: [part('b')] };
    const { rerender } = render(<Canvas features={[a, b]} />);
    mounts.length = 0;
    rerender(<Canvas features={[b]} />);
    expect(mounts).toEqual([]);
  });

  it("puts a dep a component publishes under the children's, though the preset turned on after them", () => {
    let deps: ReturnType<typeof useDepRegistry> | null = null;
    function Publish({ value }: { value: string }) {
      useDepSource(PROBE, () => value as never);
      return null;
    }
    function Read() {
      deps = useDepRegistry();
      return null;
    }
    const preset: FeaturePreset = { id: 'p', components: [() => <Publish value="preset" />] };
    const children = <><Publish value="child" /><Read /></>;
    const { rerender } = render(<Canvas features={[]}>{children}</Canvas>);
    rerender(<Canvas features={[preset]}>{children}</Canvas>);
    expect(deps!.get(PROBE)).toBe('child');
  });
});
