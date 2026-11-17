import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene, nodeShapesOf, type CanvasExtensionApi, type RectPose } from '@weasel-js/core';
import { createMeasurements } from './measurements';
import { createMeasurementsContribution } from './measureContribution';
import { MEASURE_PAINTER } from './measurePainter';
import { MEASURE_TOOLS, useMeasureTools } from './toolSets';

describe('createMeasurementsContribution', () => {
  it("paints its scene's measurements while it is attached, and stops when it detaches", () => {
    const scene = createScene<object, 'notes', RectPose>({ systemLayers: [{ id: 'notes', annotation: true }] });
    const c = createMeasurementsContribution(scene as never, createMeasurements({ layer: 'notes' }));
    const api = { registerLayer: () => () => {}, requestRedraw: () => {} } as unknown as CanvasExtensionApi;
    const detach = c.attach!(api, { get: () => undefined });
    expect(nodeShapesOf(scene).entries()).toContain(MEASURE_PAINTER);
    detach();
    expect(nodeShapesOf(scene).entries()).not.toContain(MEASURE_PAINTER);
  });
});

describe('MEASURE_TOOLS', () => {
  it('names every tool useMeasureTools builds', () => {
    const { result } = renderHook(() => useMeasureTools({ measurements: createMeasurements({ layer: 'notes' }) }));
    expect(Object.keys(result.current)).toEqual(['measure']);
    expect(MEASURE_TOOLS.members).toEqual(['measure']);
  });
});
