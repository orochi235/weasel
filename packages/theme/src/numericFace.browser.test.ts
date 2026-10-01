import './generated/tokens.css';
import './fonts.css';
import numeric from './numeric.module.css';
import { afterEach, expect, test } from 'vitest';

afterEach(() => document.body.replaceChildren());

function width(text: string, weight: number): number {
  const span = document.createElement('span');
  span.className = numeric.numeric!;
  span.style.fontWeight = String(weight);
  span.style.fontSize = '100px';
  span.textContent = text;
  document.body.append(span);
  return span.getBoundingClientRect().width;
}

test.each([200, 400, 700])('a sign and a figure space are as wide as a digit, at weight %i', async (weight) => {
  await document.fonts.load(`${weight} 100px "Oswald Tabular"`, '0+− ');
  const digit = width('00', weight);
  for (const text of ['−0', '+0', ' 0']) expect(width(text, weight)).toBeCloseTo(digit, 2);
});

test('a hyphen keeps its own width, so a date is not set as a subtraction', async () => {
  await document.fonts.load('400 100px "Oswald Tabular"', '0-');
  expect(width('-0', 400)).not.toBeCloseTo(width('00', 400), 0);
});
