import { expect, it } from 'vitest';
import { fitForm } from './legendMeasure';

const room = { size: 10, lineHeight: 1, width: 10, height: 20 };
const charWidth = (line: string) => line.length * 6;

it('fits a symbol drawn as an icon by the icon\'s size, not its character\'s', () => {
  expect(fitForm('⊞', room, charWidth).scale).toBeCloseTo(0.8);
  expect(fitForm('W', room, charWidth).scale).toBeCloseTo(10 / 6);
});
