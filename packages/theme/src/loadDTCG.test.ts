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
    expect(resolveTheme(theme, 'dark')['--wzl-accent']).toBe('#ff0000');
    expect(resolveTheme(theme, 'dark')['--wzl-surface']).toBe('#000000');
  });

  it('throws on a document with no name', () => {
    expect(() => loadDTCG({ primitives: {}, modes: {} })).toThrow(/name/i);
  });
});
