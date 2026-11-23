import { describe, expect, it } from 'vitest';
import type { LoupeMode } from '@weasel-js/loupe';
import { createWindow } from '../widgets/window/window';
import { createModeSwitch, modeSwitchBoundsIn } from './modeSwitch';
import { createZoomTrack, zoomTrackIn } from './zoomTrack';

const round = () => createWindow({ id: 'w', title: 'Loupe', shape: 'round', x: 0, y: 0, width: 200, height: 200 });
const at = (type: 'down' | 'move' | 'up', x: number, y: number) => ({ type, x, y, native: null });

describe('the mode switch', () => {
  it('fits under a round lens’s rim, and not in one too small for it', () => {
    const b = modeSwitchBoundsIn({ x: 0, y: 0, width: 188, height: 188 }, true)!;
    const r = 94;
    expect(Math.hypot(b.width / 2, r - b.y)).toBeLessThan(r);
    expect(modeSwitchBoundsIn({ x: 0, y: 0, width: 90, height: 90 }, true)).toBeNull();
  });

  it('switches to the segment clicked', () => {
    let mode: LoupeMode = 'vector';
    const win = round();
    const sw = createModeSwitch('m', { win, round: true, mode: () => mode, setMode: (m) => { mode = m; } });
    const b = sw.bounds;
    const pixel = { x: b.x + b.width * 0.75, y: b.y + b.height / 2 };
    expect(sw.hitTest(pixel.x, pixel.y)).toBe(true);
    sw.onPointer(at('down', pixel.x, pixel.y));
    sw.onPointer(at('up', pixel.x, pixel.y));
    expect(mode).toBe('pixel');
  });

  it('hides with its window', () => {
    const win = round();
    const sw = createModeSwitch('m', { win, round: true, mode: () => 'vector', setMode: () => {} });
    win.setHidden(true);
    expect(sw.hidden).toBe(true);
  });
});

describe('the zoom', () => {
  const stops = [1, 2, 4, 8, 16, 32, 64];

  it('runs across the bottom of a round lens, through 6 o’clock', () => {
    const track = zoomTrackIn({ x: 0, y: 0, width: 188, height: 188 }, true);
    const middle = track.at(0.5).point;
    expect(middle.x).toBeCloseTo(94);
    expect(middle.y).toBeGreaterThan(150);
  });

  it('sets the factor to the stop nearest a press on its band, and follows a drag', () => {
    let factor = 8;
    const win = round();
    const zoom = createZoomTrack('z', { win, round: true, stops, factor: () => factor, setFactor: (f) => { factor = f; } });
    const track = zoomTrackIn(win.contentRect, true);
    const first = track.at(0).point;
    expect(zoom.hitTest(first.x, first.y)).toBe(true);
    zoom.onPointer(at('down', first.x, first.y));
    expect(factor).toBe(1);
    const last = track.at(1).point;
    zoom.onPointer(at('move', last.x, last.y));
    expect(factor).toBe(64);
    zoom.onPointer(at('up', last.x, last.y));
  });

  it('leaves the middle of the lens to the lens', () => {
    const zoom = createZoomTrack('z', { win: round(), round: true, stops, factor: () => 8, setFactor: () => {} });
    expect(zoom.hitTest(100, 100)).toBe(false);
  });
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
