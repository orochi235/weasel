import { describe, expect, it } from 'vitest';
import { isChecked, offenders } from './check-fonts';

const css = (source: string, file = 'packages/x/src/X.module.css') => offenders(file, source);

describe('offenders', () => {
  it('catches a base face set on a component', () => {
    expect(css('.a { font-family: var(--wzl-font-ui); }')).toMatchObject([{ line: 1, why: expect.stringContaining('inherit') }]);
    expect(css('.a {\n  color: red;\n  font-family: var(--wzl-font-body);\n}')).toMatchObject([{ line: 3 }]);
  });

  it('catches a family written out, in a longhand or a shorthand', () => {
    expect(css('.a { font-family: ui-monospace, monospace; }')).toHaveLength(1);
    expect(css('.a { font: 600 11px/1.4 system-ui, sans-serif; }')).toHaveLength(1);
    expect(css('.a { font: var(--wzl-font-size-sm) / var(--wzl-leading-tight) var(--wzl-font-ui); }')).toHaveLength(1);
  });

  it('passes inherit and the role tokens', () => {
    expect(css('.a { font: inherit; } .b { font-family: inherit; }')).toEqual([]);
    expect(css('.a { font-family: var(--wzl-font-mono); } .b { font: 600 11px var(--wzl-font-display); }')).toEqual([]);
    expect(css('.a { font-family: var(--_s-title-font); }')).toEqual([]);
    expect(css('.a { font: 11px var(--wzl-font-mono, ui-monospace, monospace); }')).toEqual([]);
  });

  it('holds a custom property named for a font to the same rule, and lets it be initial', () => {
    expect(css('.a { --_s-title-font: var(--wzl-font-ui); }')).toHaveLength(1);
    expect(css('.a { --_s-title-font: var(--wzl-stance-debug-title-font, var(--wzl-font-display)); }')).toEqual([]);
    expect(css('.a { --_s-title-font: var(--wzl-stance-debug-title-font, var(--_s-unset)); }')).toEqual([]);
    expect(css('.a { --_s-title-font: initial; }')).toEqual([]);
  });

  it('passes the other font properties', () => {
    expect(css('.a { font-size: 12px; font-weight: 500; font-variant-numeric: proportional-nums; }')).toEqual([]);
  });

  it('passes a theme root and a font face', () => {
    expect(css(':root { font-family: var(--wzl-font-ui); } html, body { font: 13px system-ui; }')).toEqual([]);
    expect(css("@font-face { font-family: 'Oswald'; src: url(x.woff2); }")).toEqual([]);
  });

  it('holds every selector of a list to the root rule', () => {
    expect(css(':root, .panel { font-family: var(--wzl-font-ui); }')).toHaveLength(1);
  });

  it('passes a rule the allow list names, in its own file only', () => {
    const lab = '.lk-root { font-family: var(--wzl-font-ui); }';
    expect(css(lab, 'packages/labkit/src/theme/base.less')).toEqual([]);
    expect(css(lab)).toHaveLength(1);
  });

  it('lets an app set a base face, but not a family written out', () => {
    expect(css('.a { font-family: var(--wzl-font-ui); }', 'apps/site/X.module.css')).toEqual([]);
    expect(css('.a { font-family: monospace; }', 'apps/site/X.module.css')).toHaveLength(1);
  });

  it('judges a nested Less block apart from its parent', () => {
    expect(css('.lk-root { color: red; .b { font-family: var(--wzl-font-ui); } }', 'packages/labkit/src/theme/base.less')).toHaveLength(1);
  });
});

describe('isChecked', () => {
  it('checks stylesheets and leaves stories and the token showcase alone', () => {
    expect(isChecked('packages/ui/src/components/Button/Button.module.css')).toBe(true);
    expect(isChecked('packages/labkit/src/theme/base.less')).toBe(true);
    expect(isChecked('packages/ui/src/components/Button/Button.stories.module.css')).toBe(false);
    expect(isChecked('packages/ui/src/components/Properties/layouts.story.module.css')).toBe(false);
    expect(isChecked('packages/ui/src/components/Foundations/Type.module.css')).toBe(false);
    expect(isChecked('packages/ui/src/components/Button/Button.tsx')).toBe(false);
  });
});
