import { describe, it, expect } from 'vitest';
import { loadDTCG } from './loadDTCG';
import { resolveTheme } from './resolveTheme';

describe('loadDTCG', () => {
  it('builds a Theme from a DTCG document', () => {
    const theme = loadDTCG({
      name: 'acme',
      defaultMode: 'dark',
      primitives: { color: { $type: 'color', 'accent-base': { $value: '#ff0000' } } },
      modes: { dark: { color: { $type: 'color', surface: { $value: '#000000' } } } },
    });
    expect(theme.name).toBe('acme');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-accent']).toBe('#ff0000');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-surface']).toBe('#000000');
  });

  it('falls through to the base theme’s other modes when the document declares one', () => {
    const theme = loadDTCG({ name: 'one', modes: { dark: { color: { $type: 'color', accent: { $value: '#ff0000' } } } } });
    expect(resolveTheme(theme, { mode: 'light' })['--wzl-surface']).toBe('#f5f5f6');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-accent']).toBe('#ff0000');
  });

  it('throws on a document with no name', () => {
    expect(() => loadDTCG({ primitives: {}, modes: {} })).toThrow(/name/i);
  });
});
