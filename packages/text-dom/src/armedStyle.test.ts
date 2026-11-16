import { expect, it } from 'vitest';
import { armPatch } from './armedStyle';

it('arms nothing for a fill the caret already takes, whatever order its keys are in', () => {
  const caret = { fill: { paint: { color: '#ff0000', kind: 'solid' as const } } };
  expect(armPatch(caret, {}, { fill: { paint: { kind: 'solid', color: '#ff0000' } } })).toEqual({});
});
