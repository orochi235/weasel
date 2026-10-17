import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { asNodeId, createMeasurements, createScene, measureNode, rectPath, solid, useSelection } from '@weasel-js/core';
import { ANNOTATION_LAYER, DRAW_LAYERS, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { useState } from 'react';
import { LayersPanel } from './LayersPanel';
import { drawPrefs } from './prefs';
import { renderWithIcons } from './testIcons';

// jsdom can leave `window.localStorage` undefined; the prefs store needs one.
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.localStorage) {
    const store = new Map<string, string>();
    const fakeStorage: Storage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => { store.delete(k); },
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => fakeStorage });
  }
});

function makeScene() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
  scene.add({
    id: asNodeId('box'), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: rectPath(0, 0, 10, 10), fill: { paint: solid('#ff0000') }, label: 'Box' },
  });
  scene.add(measureNode(asNodeId('m1'), ANNOTATION_LAYER, { x: 0, y: 0 }, { x: 30, y: 40 }) as never);
  return scene;
}

function Host({ scene }: { scene: ReturnType<typeof makeScene> }) {
  const selection = useSelection({ mode: 'multi', scene });
  const measurements = useState(() => createMeasurements({ layer: ANNOTATION_LAYER }))[0];
  return (
    <LayersPanel
      scene={scene}
      selection={selection}
      measurements={measurements}
      backgroundColor="#ffffff"
      docSelected={false}
      setDocSelected={() => {}}
      chrome={{ collapsed: false, hidden: false, onToggleCollapse: () => {}, onHide: () => {} }}
    />
  );
}

describe('LayersPanel — annotations toggle', () => {
  beforeEach(() => {
    drawPrefs().reset();
    window.localStorage.clear();
  });

  it('is off by default: the measurements are not listed', () => {
    renderWithIcons(<Host scene={makeScene()} />);
    expect(drawPrefs().get('ui.showAnnotations')).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Show annotations' })).not.toBeChecked();
    expect(screen.queryByText('Measurements')).toBeNull();
    expect(screen.queryByText('Not printed')).toBeNull();
    expect(screen.getByText('Box')).toBeTruthy();
  });

  it('lists the annotation layer and each measurement, marked not printed, once on', () => {
    renderWithIcons(<Host scene={makeScene()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show annotations' }));
    expect(drawPrefs().get('ui.showAnnotations')).toBe(true);
    expect(screen.getByText('Measurements')).toBeTruthy();
    expect(screen.getByText('Measurement 50.0')).toBeTruthy();
    expect(screen.getAllByText('Not printed')).toHaveLength(2);
  });

  it('removes a measurement from its row, and leaves them out again once off', () => {
    const scene = makeScene();
    renderWithIcons(<Host scene={scene} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show annotations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Measurement 50.0' }));
    expect(scene.get(asNodeId('m1'))).toBeUndefined();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show annotations' }));
    expect(screen.queryByText('Measurements')).toBeNull();
  });
});
