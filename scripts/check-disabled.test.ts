import { describe, expect, it } from 'vitest';
import { disabledOffenders } from './check-disabled';

const css = (source: string) => disabledOffenders('x.css', source);
const CUE = 'filter: var(--wzl-disabled-filter);';

describe('disabledOffenders', () => {
  it('catches a disabled fade with no desaturation', () => {
    expect(css('.a:disabled {\n  opacity: 0.5;\n}')).toMatchObject([{ line: 2 }]);
  });

  it('passes a disabled fade that also desaturates', () => {
    expect(css(`.a[data-disabled] { opacity: 0.4; ${CUE} }`)).toEqual([]);
  });

  it('reads the disabled state from an enclosing block', () => {
    expect(disabledOffenders('x.less', '.a { &:disabled { opacity: 0.4; } }')).toHaveLength(1);
  });

  it('ignores a rule that excludes the disabled state', () => {
    expect(css('.a:hover:not(:disabled, [data-disabled]) { opacity: 0.8; }')).toEqual([]);
  });

  it('ignores an opacity that restores full strength', () => {
    expect(css('.row[data-disabled] .input:disabled { opacity: 1; }')).toEqual([]);
  });

  it('reads a percentage fade', () => {
    expect(css('.a:disabled { opacity: 50%; }')).toHaveLength(1);
  });

  it('ignores a fade outside a disabled state', () => {
    expect(css('.muted { opacity: 0.5; }')).toEqual([]);
  });
});
