import { expect, it } from 'vitest';
import { fraction, present } from './index';

it('escapes a custom constant symbol in MathML', () => {
  const display = fraction({ of: { symbol: 'a<b&c', value: 2, spoken: 'a' } });
  expect(present(1, display).mathml).toBe('<math><mfrac><mi>a&lt;b&amp;c</mi><mn>2</mn></mfrac></math>');
});
