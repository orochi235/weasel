/**
 * A `SurfaceContribution` installs every role it declares through `ambient`,
 * and removing it removes them.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { useOptionalDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { mergeContributions, type SurfaceContribution } from './surfaceContribution';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { SnapDep } from 'interactions/actions/depSchema';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const ROOT_VIEW: View = { x: 5, y: 6, scale: { x: 1, y: 1 } };
const PANEL_VIEW: View = { x: 1000, y: 2000, scale: { x: 2, y: 2 } };
const snap = { snapPoint: (p: unknown) => p } as unknown as SnapDep;

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function makeFeature(probeLayer?: RenderLayer<unknown>) {
  const teardown = vi.fn();
  const attach = vi.fn(() => teardown);
  const feature: SurfaceContribution = {
    id: 'feature',
    eligibility: { always: true },
    views: [{ id: 'panel', bounds: { x: 100, y: 0, w: 100, h: 100 }, defaultView: PANEL_VIEW }],
    deps: { snap: () => snap },
    attach,
    ...(probeLayer ? { overlay: probeLayer } : {}),
  };
  return { feature, attach, teardown };
}

function Harness({ ambient }: { ambient: SurfaceContribution[] }) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  return (
    <SceneCanvas scene={scene} layers={{}} width={300} height={200} view={ROOT_VIEW} ambient={ambient}>
      <Probe />
    </SceneCanvas>
  );
}

let views: ViewRegistry | null = null;
let deps: DepRegistry | null = null;
function Probe() {
  const v = useOptionalViewRegistry();
  const d = useOptionalDepRegistry();
  useEffect(() => { views = v; deps = d; });
  return null;
}

describe('installing a SurfaceContribution through ambient', () => {
  it('adds its view, dep and attachment, and removes all three with it', () => {
    const { feature, attach, teardown } = makeFeature();
    const r = render(<Harness ambient={[feature]} />);
    expect(views!.list().map((v) => v.id)).toContain('panel');
    expect(deps!.get('snap')).toBe(snap);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(typeof (attach.mock.calls[0] as unknown[])[0]).toBe('object');

    r.rerender(<Harness ambient={[feature]} />);
    expect(attach).toHaveBeenCalledTimes(1);

    r.rerender(<Harness ambient={[]} />);
    expect(views!.list().map((v) => v.id)).not.toContain('panel');
    // The surface's own snap source sits beneath the entry's; removal uncovers it.
    expect(deps!.get('snap')).not.toBe(snap);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('hands attach a reader over the surface\'s deps', () => {
    const { feature, attach } = makeFeature();
    render(<Harness ambient={[feature]} />);
    const reader = (attach.mock.calls[0] as unknown[])[1] as DepRegistry;
    expect(reader.get('snap')).toBe(snap);
  });
});

describe('rootView', () => {
  it('answers the surface camera inside a view, where view answers the view\'s', () => {
    const { feature } = makeFeature();
    render(<Harness ambient={[feature]} />);
    const panel = views!.list().find((v) => v.id === 'panel')!;
    const overlay = panel.target.deps!();
    expect(overlay.view!.get()).toEqual(PANEL_VIEW);
    expect(overlay.rootView).toBeUndefined();
    expect(deps!.get('rootView')!.get()).toEqual(ROOT_VIEW);
  });
});

describe('layer data names the view it draws for', () => {
  it('is null on the surface and the view id inside a view', () => {
    const seen: (string | null)[] = [];
    const probe: RenderLayer<unknown> = {
      id: 'probe',
      label: 'probe',
      draw: (data) => { seen.push((data as { viewId: string | null }).viewId); return []; },
    };
    const { feature } = makeFeature(probe);
    render(<Harness ambient={[feature]} />);
    const panel = views!.list().find((v) => v.id === 'panel')!;
    panel.layer.draw({ viewId: null }, ROOT_VIEW, { width: 300, height: 200 });
    expect(seen).toEqual(['panel']);
  });
});

describe('mergeContributions', () => {
  it('throws naming a view id two entries both add', () => {
    const a = makeFeature().feature;
    const b = { ...makeFeature().feature, id: 'other', deps: undefined };
    expect(() => mergeContributions([a], [b])).toThrow(/view "panel" is added by both "feature" and "other"/);
  });
});
