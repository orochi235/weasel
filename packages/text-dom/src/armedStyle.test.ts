import { expect, it } from 'vitest';
import type { RunStylePatch } from '@weasel-js/text';
import { armedOver, armPatch, withArmed } from './armedStyle';

it('arms nothing for a fill the caret already takes, whatever order its keys are in', () => {
  const caret = { fill: { paint: { color: '#ff0000', kind: 'solid' as const } } };
  expect(armPatch(caret, {}, { fill: { paint: { kind: 'solid', color: '#ff0000' } } })).toEqual({});
});

it('lays a key named __proto__ over the style as data, not as a prototype', () => {
  const armed = JSON.parse('{"__proto__": {"bold": true}}') as RunStylePatch;
  const out = withArmed({}, armed);
  expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  expect(Object.hasOwn(out, '__proto__')).toBe(true);
  expect(Object.hasOwn(armedOver({}, armed), '__proto__')).toBe(true);
});
