import { afterEach, expect, test } from 'vitest';
import { lineShape, trackRun } from '@weasel-js/geom';
import { curvedGeometry } from './sliderGeometry';
import s from './Slider.module.css';

const SVG = 'http://www.w3.org/2000/svg';
afterEach(() => document.body.replaceChildren());

/** The thickness a curved band measures when its track height is `height`. */
function thickness(height?: string, tickLength?: string): number {
  const root = document.createElement('div');
  root.className = s.curved!;
  if (height) root.style.setProperty('--rp-track-height', height);
  if (tickLength) root.style.setProperty('--rp-tick-length', tickLength);
  const svg = document.createElementNS(SVG, 'svg');
  const face = document.createElementNS(SVG, 'path');
  face.setAttribute('class', s.bandFace!);
  svg.append(face);
  root.append(svg);
  document.body.append(root);
  const geo = curvedGeometry(trackRun(lineShape({ x: 0, y: 0 }, { x: 200, y: 0 })), () => face);
  return geo.measure(50, 0)!.thickness;
}

test('a curved band reads its track height in any unit', () => {
  expect(thickness('20px')).toBe(20);
  expect(thickness('2rem')).toBe(32);
  expect(thickness('calc(10px + 1rem)')).toBe(26);
});

test('with no track height a curved band is half its tick length', () => {
  expect(thickness()).toBe(7);
  expect(thickness(undefined, '20px')).toBe(10);
});
