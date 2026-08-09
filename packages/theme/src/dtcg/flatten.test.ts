import { describe, it, expect } from 'vitest';
import { flattenTokens } from './flatten';

describe('flattenTokens', () => {
  it('drops the type group from the name and inherits $type', () => {
    const out = flattenTokens({
      color: { $type: 'color', 'fg-muted': { $value: '#9ea1a8' } },
    });
    expect(out).toEqual({
      'fg-muted': { type: 'color', value: '#9ea1a8', alpha: undefined, description: undefined },
    });
  });

  it('carries $description and the alpha extension through', () => {
    const out = flattenTokens({
      color: {
        $type: 'color',
        line: { $value: '{color.fg}', $description: 'gridlines', $extensions: { 'com.weasel.alpha': 0.2 } },
      },
    });
    expect(out.line.alpha).toBe(0.2);
    expect(out.line.description).toBe('gridlines');
    expect(out.line.value).toBe('{color.fg}');
  });

  it('preserves array and numeric values verbatim', () => {
    const out = flattenTokens({
      cubicBezier: { $type: 'cubicBezier', 'ease-out-cubic': { $value: [0.33, 1, 0.68, 1] } },
      fontWeight: { $type: 'fontWeight', 'font-weight-bold': { $value: 400 } },
    });
    expect(out['ease-out-cubic'].value).toEqual([0.33, 1, 0.68, 1]);
    expect(out['font-weight-bold'].value).toBe(400);
  });

  it('throws when a token has no resolvable $type', () => {
    expect(() => flattenTokens({ color: { fg: { $value: '#fff' } } }))
      .toThrow(/fg.*\$type/);
  });

  it('throws on a duplicate leaf name across type groups', () => {
    expect(() =>
      flattenTokens({
        color: { $type: 'color', line: { $value: '#fff' } },
        dimension: { $type: 'dimension', line: { $value: '2px' } },
      }),
    ).toThrow(/duplicate.*line/i);
  });
});
