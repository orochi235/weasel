import type { ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { lookupOf, spaced } from './fixtures';
import { scaleTable } from './scales';

describe('scaleTable', () => {
  it('gives one column per value of each axis the scale varies on', () => {
    expect(scaleTable(spaced, lookupOf(spaced), 'space')).toEqual({
      steps: ['xs', 'sm', 'md'],
      columns: [
        { label: 'density=comfortable', selection: { density: 'comfortable' }, values: { xs: '4px', sm: '8px', md: '12px' } },
        { label: 'density=compact', selection: { density: 'compact' }, values: { xs: '4px', sm: '7px', md: '10px' } },
      ],
    });
  });

  it('gives a single column to a scale that varies on nothing', () => {
    const flat: ThemeDefinition = { ...spaced, scales: { space: { steps: ['xs', 'sm'], base: 4, ratio: 2 } } };
    expect(scaleTable(flat, lookupOf(flat), 'space').columns).toEqual([{ label: 'value', selection: {}, values: { xs: '4px', sm: '8px' } }]);
  });
});
