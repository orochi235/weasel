import { describe, expect, it } from 'vitest';
import type { LoupeMode } from '@weasel-js/loupe';
import { createHud } from '../hud';
import { createWindow } from '../widgets/window/window';
import { addLensControls } from './lensControls';
import { createModeSwitch } from './modeSwitch';
import { RIM_GAP, rimTrackIn } from './rimTracks';
import { createZoomTrack } from './zoomTrack';

const B = { x: 0, y: 0, width: 200, height: 200 };
const round = () => createWindow({ id: 'w', title: 'Loupe', shape: 'round', ...B });
const at = (type: 'down' | 'move' | 'up', x: number, y: number) => ({ type, x, y, native: null });
const shown = () => true;

describe('the ring', () => {
  it('runs outside the rim, the zoom from the lower left through 6 o’clock, then the switch', () => {
    for (const part of ['zoom', 'mode'] as const) {
      for (const f of [0, 0.5, 1]) {
        const p = rimTrackIn(B, true, part).at(f).point;
        expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(100 + RIM_GAP);
      }
    }
    expect(rimTrackIn(B, true, 'zoom').at(0).point.x).toBeLessThan(100);
    expect(rimTrackIn(B, true, 'mode').at(0).point.x).toBeGreaterThan(rimTrackIn(B, true, 'zoom').at(1).point.x);
  });
});

describe('the mode switch', () => {
  it('switches to the segment clicked', () => {
    let mode: LoupeMode = 'vector';
    const win = round();
    const sw = createModeSwitch('m', { win, round: true, shown, mode: () => mode, setMode: (m) => { mode = m; } });
    const pixel = rimTrackIn(win.bounds, true, 'mode').at(0.75).point;
    expect(sw.hitTest(pixel.x, pixel.y)).toBe(true);
    sw.onPointer(at('down', pixel.x, pixel.y));
    sw.onPointer(at('up', pixel.x, pixel.y));
    expect(mode).toBe('pixel');
  });

  it('hides with its window', () => {
    const win = round();
    const sw = createModeSwitch('m', { win, round: true, shown, mode: () => 'vector', setMode: () => {} });
    win.setHidden(true);
    expect(sw.hidden).toBe(true);
  });
});

describe('the zoom', () => {
  const stops = [1, 2, 4, 8, 16, 32, 64];

  it('sets the factor to the stop nearest a press on its band, and follows a drag', () => {
    let factor = 8;
    const win = round();
    const zoom = createZoomTrack('z', { win, round: true, shown, stops, factor: () => factor, setFactor: (f) => { factor = f; } });
    const track = rimTrackIn(win.bounds, true, 'zoom');
    const first = track.at(0).point;
    expect(zoom.hitTest(first.x, first.y)).toBe(true);
    zoom.onPointer(at('down', first.x, first.y));
    expect(factor).toBe(1);
    const last = track.at(1).point;
    zoom.onPointer(at('move', last.x, last.y));
    expect(factor).toBe(64);
    zoom.onPointer(at('up', last.x, last.y));
  });

  it('leaves the lens itself to the lens', () => {
    const zoom = createZoomTrack('z', { win: round(), round: true, shown, stops, factor: () => 8, setFactor: () => {} });
    expect(zoom.hitTest(100, 100)).toBe(false);
  });
});

it('shows the controls only while the pointer is near the lens', () => {
  const hud = createHud();
  const win = round();
  const controls = addLensControls({
    hud, win, round: true, stops: [1, 2, 4], requestRedraw: () => {},
    mode: () => 'vector', setMode: () => {}, factor: () => 2, setFactor: () => {},
  });
  const ring = hud.widgets();
  expect(ring.every((w) => w.hidden)).toBe(true);
  controls.pointerAt({ x: 100, y: 100 });
  expect(ring.every((w) => !w.hidden)).toBe(true);
  controls.pointerAt({ x: 600, y: 600 });
  expect(ring.every((w) => w.hidden)).toBe(true);
  controls.remove();
  expect(hud.widgets()).toHaveLength(0);
});

it('says it is moving only while a drag moves it', () => {
  const win = round();
  win.onPointer(at('down', 100, 100));
  expect(win.moving).toBe(false);
  win.onPointer(at('move', 130, 100));
  expect(win.moving).toBe(true);
  win.onPointer(at('up', 130, 100));
  expect(win.moving).toBe(false);
});
