/**
 * `<SceneCanvas modes>` takes the app's mode registry, and the route-conflict
 * check reads the app's modes from it rather than the kit's `DEFAULT_MODES`.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createModeRegistry, type ModeDefinition } from '@weasel-js/modes';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const dragAction = (id: string, capability: string) => ({
  id,
  label: id,
  defaultBinding: { kind: 'drag' },
  eligible: { capability },
  invoker: { timing: 'immediate', run: () => {} },
}) as never;

const mode = (id: string, allows: string[]): ModeDefinition => ({ id, kind: 'soft', allows, scoping: false });

function conflictsWith(modes: readonly ModeDefinition[]): string[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const registry = createModeRegistry({ modes, initial: modes[0].id });
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  render(
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
      modes={registry}
      actions={{ stamp: dragAction('app.stamp', 'stamps'), sweep: dragAction('app.sweep', 'sweeps') }} />,
  );
  return warn.mock.calls.map((a) => String(a[0])).filter((m) => m.includes('route conflict'));
}

describe('<SceneCanvas modes>', () => {
  it('reports a clash that only an app-defined mode lets happen', () => {
    const found = conflictsWith([mode('stamp', ['stamps']), mode('both', ['stamps', 'sweeps'])]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('app.stamp');
    expect(found[0]).toContain('app.sweep');
  });

  it('stays quiet when none of the app modes lets both hold', () => {
    expect(conflictsWith([mode('stamp', ['stamps']), mode('sweep', ['sweeps'])])).toEqual([]);
  });
});
