import { resolveTheme, weaselTheme, type ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';

describe('deriveDraft', () => {
  it('derives every mode and bakes a runtime theme under the draft name', () => {
    const d = deriveDraft(weasel, lookupOf(), {});
    expect(d.theme.name).toBe('draft-weasel');
    expect(d.views.map((v) => v.mode)).toEqual(['dark', 'light']);
    expect(d.primary.mode).toBe('dark');
    expect(d.primary.resolved['--wzl-surface']).toBe(resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface']);
  });

  it('carries the viewed value of every other axis into each view', () => {
    const dense: ThemeDefinition = {
      name: 'dense',
      axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
      pins: { gap: { by: 'density', comfortable: { value: '8px', type: 'dimension' }, compact: { value: '4px', type: 'dimension' } } },
    };
    const d = deriveDraft(dense, lookupOf(dense), { density: 'compact' });
    expect(d.views.map((v) => v.mode)).toEqual([undefined]);
    expect(d.primary.selection).toEqual({ density: 'compact' });
  });
});
