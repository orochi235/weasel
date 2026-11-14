import { expect, test } from 'vitest';
import { joiningRuns } from './joiningRuns';

test('an Arabic word breaks after each letter that joins only the one before it', () => {
  // seen, lam, alef, meem: alef does not join the letter after it.
  expect(joiningRuns([...'سلام'])).toEqual(['سلا', 'م']);
  expect(joiningRuns([...'بيروت'])).toEqual(['بير', 'و', 'ت']);
});

test('a space, a Latin letter or a Hebrew one joins nothing', () => {
  expect(joiningRuns([...'بب ab אב'])).toEqual(['بب', ' ', 'a', 'b', ' ', 'א', 'ב']);
});

test('a lone letter is a run of its own', () => {
  expect(joiningRuns(['ب'])).toEqual(['ب']);
});

test('a letter carrying marks joins as its base does', () => {
  expect(joiningRuns(['بَ', 'تِ', ' '])).toEqual(['بَتِ', ' ']);
});

test('a zero-width non-joiner ends the run', () => {
  // Persian mi-khaham: meem, yeh + ZWNJ, kheh, alef, heh, meem.
  expect(joiningRuns(['م', 'ی‌', 'خ', 'ا', 'ه', 'م'])).toEqual(['می‌', 'خا', 'هم']);
});

test('a tatweel joins on both sides', () => {
  expect(joiningRuns([...'بـب'])).toEqual(['بـب']);
});

test('Syriac and N\'Ko join too', () => {
  // olaph is right-joining, beth dual-joining.
  expect(joiningRuns([...'ܒܐܒ'])).toEqual(['ܒܐ', 'ܒ']);
  expect(joiningRuns([...'ߒߞߏ'])).toEqual(['ߒߞߏ']);
});
