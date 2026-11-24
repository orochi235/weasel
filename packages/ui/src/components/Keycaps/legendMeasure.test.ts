import { expect, it } from 'vitest';
import { fitForm, readRoom } from './legendMeasure';

const room = { size: 10, lineHeight: 1, width: 10, height: 20, iconScale: 1.25 };
const charWidth = (line: string) => line.length * 6;

it('fits a symbol drawn as an icon by the icon\'s size, not its character\'s', () => {
  expect(fitForm('⊞', room, charWidth).scale).toBeCloseTo(0.8);
  expect(fitForm('W', room, charWidth).scale).toBeCloseTo(10 / 6);
});

it('reads a key with no box, as one hidden by display: none, as unmeasurable', () => {
  const kbd = document.createElement('kbd');
  kbd.style.fontSize = '12px';
  document.body.append(kbd);
  expect(kbd.clientWidth).toBe(0);
  expect(readRoom(kbd)).toBeNull();
  kbd.remove();
});

it('sizes an icon legend by the icon scale its key\'s stylesheet draws it at', () => {
  const kbd = document.createElement('kbd');
  kbd.style.fontSize = '10px';
  kbd.style.setProperty('--key-legend-icon-scale', '2');
  Object.defineProperties(kbd, { clientWidth: { value: 30 }, clientHeight: { value: 44 } });
  document.body.append(kbd);
  const read = readRoom(kbd)!;
  expect(read.iconScale).toBe(2);
  expect(fitForm('⌘', read, charWidth).scale).toBeCloseTo(1.5);
  kbd.remove();
});
