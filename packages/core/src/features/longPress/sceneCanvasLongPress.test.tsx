/**
 * `<SceneCanvas>` publishes its dispatcher's pending long-press as the
 * `longPress` dep, and installs whatever `longPress.feedback` names against it.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { LongPressState } from '@weasel-js/routing';
import { SceneCanvas } from '../../canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from '../../canvas/surfaceContribution';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function mount(feedback: SurfaceContribution, ambient: SurfaceContribution[] = []) {
  const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  const r = render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} longPress={{ feedback }} ambient={ambient} />,
  );
  return r.container.querySelector('canvas')!;
}

function capture(): { entry: SurfaceContribution; state: () => LongPressState | undefined } {
  let state: LongPressState | undefined;
  const entry: SurfaceContribution = {
    id: 'probe',
    eligibility: { always: true },
    attach: (_api, deps) => { state = deps.get('longPress'); return () => {}; },
  };
  return { entry, state: () => state };
}

const bound: SurfaceContribution = {
  id: 'bound',
  eligibility: { always: true },
  actions: [{ id: 'test.hold', label: 'hold', invoker: { timing: 'immediate', run: () => {} } }],
  bindings: [{ spec: { kind: 'longPress' }, actionId: 'test.hold' }],
};

function touchDown(canvas: Element) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, pointerType: 'touch', button: 0, buttons: 1, clientX: 40, clientY: 30,
    }));
  });
}

describe('<SceneCanvas> long-press state', () => {
  it('hands a replacement feedback entry the pending press, armed when a binding would fire', () => {
    const probe = capture();
    const canvas = mount(probe.entry, [bound]);
    expect(probe.state()).toBeDefined();
    touchDown(canvas);
    expect(probe.state()?.get()).toMatchObject({ pointerType: 'touch', armed: true });
  });

  it('reports the press unarmed when nothing is bound to it', () => {
    const probe = capture();
    const canvas = mount(probe.entry);
    touchDown(canvas);
    expect(probe.state()?.get()?.armed).toBe(false);
  });
});
