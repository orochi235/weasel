import { describe, expect, it } from 'vitest';
import { scriptOffenders, styleOffenders } from './check-numeric';

const css = (source: string) => styleOffenders('x.css', source);

describe('styleOffenders', () => {
  it('catches tabular-nums written out', () => {
    expect(css('.a { font-variant-numeric: tabular-nums; }')).toMatchObject([{ line: 1 }]);
  });

  it('catches the numeric token written out, in a longhand or a shorthand', () => {
    expect(css('.a { font-family: var(--wzl-font-numeric); }')).toHaveLength(1);
    expect(css('.a { font: 12px/1 var(--wzl-font-numeric); }')).toHaveLength(1);
  });

  it('passes a definition of the token, which is not a read of it', () => {
    expect(css(':root { --wzl-font-numeric: var(--wzl-font-ui); }')).toEqual([]);
    expect(scriptOffenders('x.ts', "const rule = '--wzl-font-numeric: var(--wzl-font-ui);';")).toEqual([]);
  });

  it('passes a rule that composes the helper', () => {
    expect(css(".a { composes: numeric from '@weasel-js/theme/numeric.module.css'; color: red; }")).toEqual([]);
  });

  it('passes a Less rule that mixes the helper in', () => {
    expect(styleOffenders('x.less', '.a { .numeric(); color: red; }')).toEqual([]);
  });

  // A composed class is declared first, so these in the composing rule win the tie.
  it('catches a font property beside the helper', () => {
    const source = ".a {\n  composes: numeric from '@weasel-js/theme/numeric.module.css';\n  font: 12px sans-serif;\n}";
    expect(css(source)).toMatchObject([{ line: 3, why: expect.stringContaining('replaces') }]);
    expect(css('.a { .numeric(); font-family: serif; }')).toHaveLength(1);
  });

  it('passes font-size and font-weight beside the helper', () => {
    expect(css('.a { .numeric(); font-size: 12px; font-weight: 500; }')).toEqual([]);
  });

  it('judges a nested Less block apart from its parent', () => {
    expect(styleOffenders('x.less', '.a { .numeric(); &__b { font-family: serif; } }')).toEqual([]);
  });

  it('ignores comments', () => {
    expect(css('/* tabular-nums aligns nothing in Oswald */ .a { color: red; }')).toEqual([]);
  });

  it('exempts the helper itself', () => {
    expect(styleOffenders('packages/theme/src/numeric.module.css', '.numeric { font-variant-numeric: tabular-nums; }')).toEqual([]);
  });
});

describe('scriptOffenders', () => {
  it('catches an inline tabular-nums style', () => {
    expect(scriptOffenders('x.tsx', "<span style={{ fontVariantNumeric: 'tabular-nums' }} />")).toHaveLength(1);
  });

  it('passes a URL, which is not a comment', () => {
    expect(scriptOffenders('x.ts', "const u = 'https://example.com';")).toEqual([]);
  });
});
