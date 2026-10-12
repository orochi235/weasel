import '@weasel-js/theme/tokens.css';
import '../styles.less';
import './Lab.density.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CanvasStack } from '../canvas/CanvasStack';
import { useSurfaceTile } from '../surface/useSurfaceTile';
import { LabSurface } from './LabSurface';

// A window moved to a display of another density: the device pixel ratio
// changes and no box does, so no ResizeObserver fires. Only a browser has the
// `(resolution)` media query that reports it.

/** The iframe the test page runs in. Zooming it is a page zoom to the page
 *  inside: its device pixel ratio changes and its viewport, in CSS pixels, does
 *  not. `Emulation.setDeviceMetricsOverride` changes the ratio too, but inside
 *  a frame the `(resolution)` query then never reports it. */
const frame = () => window.frameElement as HTMLElement;

afterEach(() => {
  cleanup();
  frame().style.zoom = '';
});

/** The shared buffers are sized by a frame, and a surface with no tile has none. */
function Tile() {
  return <div className="lk-density-tile" ref={useSurfaceTile('probe')} />;
}

const LAYERS = [{ id: 'fill', visible: true, render: () => {} }];
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

/** Each canvas's backing size and its CSS box. */
const sizes = (selector: string): number[][] =>
  [...document.querySelectorAll<HTMLCanvasElement>(selector)].map((canvas) => {
    const box = canvas.getBoundingClientRect();
    return [canvas.width, canvas.height, box.width, box.height];
  });

test('the shared buffers and the layer canvases take a new device pixel ratio with no resize', async () => {
  render(
    <div className="lk-density-frame">
      <LabSurface bodyRef={() => {}}>
        <Tile />
        <div className="lk-density-stack">
          <CanvasStack layers={LAYERS} view={VIEW} onViewChange={() => {}} />
        </div>
      </LabSurface>
    </div>,
  );
  const was = window.devicePixelRatio;
  const now = was * 2;
  const buffer = (dpr: number) => [400 * dpr, 300 * dpr, 400, 300];
  const layer = (dpr: number) => [200 * dpr, 100 * dpr, 200, 100];
  await expect.poll(() => sizes('.lk-lab__surface')).toEqual([buffer(was), buffer(was)]);
  await expect.poll(() => sizes('.lk-canvas-stack__canvas')).toEqual([layer(was)]);

  frame().style.zoom = '2';
  await expect.poll(() => window.devicePixelRatio).toBe(now);

  await expect.poll(() => sizes('.lk-lab__surface')).toEqual([buffer(now), buffer(now)]);
  await expect.poll(() => sizes('.lk-canvas-stack__canvas')).toEqual([layer(now)]);
});
