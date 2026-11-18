/**
 * A `tools` takeover replaces the canvas's tools, not its always-on entries: the `ambient` prop, provided ambient
 * and preset contributions still install and route under one.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from '../SceneCanvas';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import type { SurfaceContribution } from '../surfaceContribution';
import { AmbientContributionsProvider } from '../ambientContributions';
import type React from 'react';
import type { FeaturePreset } from './features';
import { useTools } from '../../tools/overlayBinding';
import { WeaselProvider } from '../../WeaselProvider';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/** An entry that records its `attach` and binds a press to an action of its own, declaring no slot. */
function probe(id: string) {
  const attach = vi.fn(() => () => {});
  const run = vi.fn();
  const entry: SurfaceContribution = {
    id,
    eligibility: {},
    attach,
    actions: [{ id: `test.${id}`, label: id, invoker: { timing: 'immediate', run } }],
    bindings: [{ spec: { kind: 'pointerDown' }, actionId: `test.${id}` }],
  };
  return { entry, attach, run };
}

function Takeover(props: {
  own?: SurfaceContribution[];
  ambient?: SurfaceContribution[];
  features?: FeaturePreset[];
}) {
  const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const tools = useTools({ active: null, registry: {}, ...(props.own ? { ambient: props.own } : {}) });
  return (
    <SceneCanvas
      scene={scene} layers={{}} width={400} height={300} tools={tools}
      {...(props.ambient ? { ambient: props.ambient } : {})}
      {...(props.features ? { features: props.features } : {})}
    />
  );
}

function press(canvas: Element) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 40, clientY: 30,
    }));
  });
}

describe('<SceneCanvas> always-on entries under a tools takeover', () => {
  const sources: Array<[string, (entry: SurfaceContribution) => React.ReactElement]> = [
    ['the ambient prop', (entry) => <Takeover ambient={[entry]} />],
    ['provided ambient', (entry) => (
      <AmbientContributionsProvider contributions={[entry]}><Takeover /></AmbientContributionsProvider>
    )],
    ['a preset contribution', (entry) => <Takeover features={[{ id: 'test:contributes', contributions: [entry] }]} />],
  ];

  it.each(sources)('installs and routes %s', (_name, mount) => {
    const p = probe('entry');
    const canvas = render(<WeaselProvider>{mount(p.entry)}</WeaselProvider>).container.querySelector('canvas')!;
    expect(p.attach).toHaveBeenCalledTimes(1);
    press(canvas);
    expect(p.run).toHaveBeenCalledTimes(1);
  });

  it("leaves an id the takeover holds to the takeover's entry", () => {
    const canvasOwn = probe('shared');
    const takeoverOwn = probe('shared');
    render(<WeaselProvider><Takeover own={[takeoverOwn.entry]} ambient={[canvasOwn.entry]} /></WeaselProvider>);
    expect(takeoverOwn.attach).toHaveBeenCalledTimes(1);
    expect(canvasOwn.attach).not.toHaveBeenCalled();
  });
});
