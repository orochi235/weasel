import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { asNodeId, createMeasurements, createScene, type PathEffect, useSelection } from '@weasel-js/core';
import { useState } from 'react';
import { ANNOTATION_LAYER, DRAW_LAYERS, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { SelectionProperties } from './sidebarPanels';
import { SurfaceHostContext } from './surfaces/hostContext';
import type { SidebarHost } from './surfaces/types';
import { renderWithIcons } from './testIcons';

const EFFECTS: [PathEffect['kind'], string][] = [
  ['textAlong', 'Text Along Path'],
  ['blend', 'Blend'],
  ['bendAlong', 'Bend Along Path'],
  ['repeatAlong', 'Repeat Along Path'],
  ['roughen', 'Roughen'],
  ['zigzag', 'Zigzag'],
  ['puckerBloat', 'Pucker & Bloat'],
];

function makeScene(kind: PathEffect['kind']) {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
  scene.add({
    id: asNodeId('fx'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { pathEffect: { kind } as PathEffect },
  });
  return scene;
}

function Host({ kind }: { kind: PathEffect['kind'] }) {
  const scene = useState(() => makeScene(kind))[0];
  const selection = useSelection({ mode: 'multi', scene, initial: [asNodeId('fx')] });
  const host: SidebarHost = {
    scene, selection, measurements: useState(() => createMeasurements({ layer: ANNOTATION_LAYER }))[0],
    filename: '', setFilename: () => {}, backgroundColor: '#ffffff', setBackgroundColor: () => {},
    paperSize: 'letter' as never, setPaperSize: () => {}, docSelected: false, setDocSelected: () => {},
    cornerSelection: { editingId: () => null, selectedAnchors: () => new Set(), subscribe: () => () => {} },
    simplifyTolerance: 1, setSimplifyTolerance: () => {},
  };
  return <SurfaceHostContext.Provider value={host}><SelectionProperties /></SurfaceHostContext.Provider>;
}

describe('SelectionProperties on a path-effect node', () => {
  it.each(EFFECTS)('titles a %s node by its effect', (kind, title) => {
    renderWithIcons(<Host kind={kind} />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText('Unknown')).toBeNull();
  });
});
