import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMemo, useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createKitSettingsStore, KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { createFunctionLayer, functionLayerState } from './createFunctionLayer';
import { createKeyframeLayer, keyframeLayerState, type KeyframeLayerConfig, type KeyframeLayerState } from './createKeyframeLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import type { CurveLayer, LayerCtx, LayerHit, PlotPoint } from './layerTypes';

afterEach(cleanup);

/** A 200×100 plot over x 0…1000 and y 0…10, as the editor makes it, reading `settings`. */
function ctxWith(settings?: KitSettingsOverrides): LayerCtx {
  const modelRange = { xMin: 0, xMax: 1000, yMin: 0, yMax: 10 };
  return {
    modelRange,
    plotSize: { width: 200, height: 100 },
    toPlot: (p) => ({ x: p.x / 5, y: 100 - p.y * 10 }),
    toModel: (p) => ({ x: p.x * 5, y: (100 - p.y) / 10 }),
    modifiers: { shift: false, alt: false, meta: false, ctrl: false },
    ...(settings ? { kitSettings: createKitSettingsStore(settings) } : {}),
  };
}

describe('createKeyframeLayer kit settings', () => {
  // Plot points: keys at (0,100), (100,0), (200,50); segment 1 eases by [0.4, 0, 0.2, 1], its handles at (40,100)
  // and (20,0); segment 2 is a straight line.
  const layer = createKeyframeLayer();
  const state = {
    ...keyframeLayerState([
      { t: 0, value: 0 },
      { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] as const } },
      { t: 1000, value: 5 },
    ]),
    selectedSegment: 1,
  };
  const hit = (plot: PlotPoint, settings?: KitSettingsOverrides): string | undefined =>
    layer.hitTest!(state, plot, ctxWith(settings))?.kind;

  it('takes a key inside targets.curveKeyHitPx, the constant without it', () => {
    expect(hit({ x: 112, y: 0 })).not.toBe('key');
    expect(hit({ x: 112, y: 0 }, { targets: { curveKeyHitPx: 20 } })).toBe('key');
  });

  it('takes a handle inside targets.curveHandleHitPx, the constant without it', () => {
    expect(hit({ x: 40, y: 88 })).not.toBe('handle');
    expect(hit({ x: 40, y: 88 }, { targets: { curveHandleHitPx: 20 } })).toBe('handle');
  });

  it('takes a segment inside targets.curveHitPx, the constant without it', () => {
    // 10px under the midpoint of the straight segment: about 8.9px from it.
    expect(hit({ x: 150, y: 35 })).toBeUndefined();
    expect(hit({ x: 150, y: 35 }, { targets: { curveHitPx: 20 } })).toBe('segment');
  });
});

describe('createFunctionLayer kit settings', () => {
  // Anchors at (0,100) and (200,0): the line y = 100 - x/2.
  const layer = createFunctionLayer({ interpolation: 'linear' });
  const state = functionLayerState([{ x: 0, y: 0 }, { x: 1000, y: 10 }]);
  const hit = (plot: PlotPoint, settings?: KitSettingsOverrides): string | undefined =>
    layer.hitTest!(state, plot, ctxWith(settings))?.kind;

  it('takes an anchor inside targets.curveAnchorSnapPx, the constant without it', () => {
    expect(hit({ x: 0, y: 85 })).toBeUndefined();
    expect(hit({ x: 0, y: 85 }, { targets: { curveAnchorSnapPx: 20 } })).toBe('anchor');
  });

  it('takes the curve inside targets.functionCurveHitPx, the constant without it', () => {
    // 10px under the line at x 100: about 8.9px from it.
    expect(hit({ x: 100, y: 60 })).toBeUndefined();
    expect(hit({ x: 100, y: 60 }, { targets: { functionCurveHitPx: 20 } })).toBe('curve');
  });
});

describe('LayeredCurveEditor kit settings', () => {
  const pressedWith = (wrap: boolean): unknown => {
    let seen: unknown = 'not pressed';
    const probe: CurveLayer<null> = {
      id: 'probe',
      render: () => null,
      hitTest: (_s: null, _p: PlotPoint, ctx: LayerCtx): LayerHit | null => {
        seen = ctx.kitSettings?.get('targets.curveKeyHitPx');
        return null;
      },
    } as unknown as CurveLayer<null>;
    const editor = (
      <LayeredCurveEditor layers={[{ layer: probe, state: null }]} onLayerChange={() => {}} width={200} height={100}
        xRange={[0, 1000]} yRange={[0, 10]} history={false} />
    );
    render(wrap ? <KitSettingsProvider value={{ targets: { curveKeyHitPx: 30 } }}>{editor}</KitSettingsProvider> : editor);
    fireEvent.pointerDown(document.querySelector('svg')!, { clientX: 50, clientY: 50, button: 0, pointerId: 1 });
    return seen;
  };

  it("hands a layer the provider's settings, and none it does not set", () => {
    expect(pressedWith(true)).toBe(30);
    cleanup();
    expect(pressedWith(false)).toBeUndefined();
  });
});

describe('createKeyframeLayer snap reach', () => {
  function Keys({ config, onCommit }: { config: KeyframeLayerConfig; onCommit: (next: KeyframeLayerState) => void }) {
    const layer = useMemo(() => createKeyframeLayer(config), [config]);
    const [state, setState] = useState(() => keyframeLayerState([{ t: 0, value: 0 }, { t: 500, value: 10 }, { t: 1000, value: 5 }]));
    return (
      <LayeredCurveEditor layers={[{ layer, state }]} onLayerChange={(_id, next) => setState(next as KeyframeLayerState)}
        onLayerCommit={(_id, next) => onCommit(next as KeyframeLayerState)} width={200} height={100}
        xRange={[0, 1000]} yRange={[0, 10]} history={false} />
    );
  }

  // The key at t 500 dragged to plot x 125 is t 625: 5px from the snap time at 600.
  const droppedAt = (config: KeyframeLayerConfig, settings?: KitSettingsOverrides): number => {
    const onCommit = vi.fn();
    const keys = <Keys config={config} onCommit={onCommit} />;
    render(settings ? <KitSettingsProvider value={settings}>{keys}</KitSettingsProvider> : keys);
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 0, button: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 125, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 125, clientY: 0, pointerId: 1 });
    return (onCommit.mock.calls[0][0] as KeyframeLayerState).keys[1].t;
  };

  it("snaps inside the constant with no provider, the provider's targets.snapRadiusPx, and the layer's own over both", () => {
    const config = { snapX: [600] };
    expect(droppedAt(config)).toBe(600);
    cleanup();
    expect(droppedAt(config, { targets: { snapRadiusPx: 2 } })).toBe(625);
    cleanup();
    expect(droppedAt({ ...config, snapRadiusPx: 6 }, { targets: { snapRadiusPx: 2 } })).toBe(600);
  });
});
