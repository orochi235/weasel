import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { mergeChain } from './merge';

const merge = (parent: ThemeDefinition, child: ThemeDefinition) => mergeChain(child, (n) => (n === parent.name ? parent : undefined));

describe('mergeChain, shrunk counterexamples', () => {
  it('fills an axis value named like an Object.prototype member from the parent', () => {
    const parent: ThemeDefinition = { name: 'p', axes: { mode: { default: 'dark', values: { dark: {}, constructor: {} } } }, pins: { accent: '#ff0000' } };
    const kid: ThemeDefinition = { name: 'k', extends: 'p', pins: { accent: { by: 'mode' } } };
    expect(merge(parent, kid).pins!.accent).toEqual({ by: 'mode', dark: '#ff0000', constructor: '#ff0000' });
  });

  it('fills nothing into a pin named like an Object.prototype member the parent does not have', () => {
    const parent: ThemeDefinition = { name: 'p', axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } } };
    const kid: ThemeDefinition = { name: 'k', extends: 'p', pins: { constructor: { by: 'mode', dark: '4px' } } };
    expect(merge(parent, kid).pins!.constructor).toEqual({ by: 'mode', dark: '4px' });
  });
});
