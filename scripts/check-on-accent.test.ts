import { describe, expect, it } from 'vitest';
import { onAccentOffenders } from './check-on-accent';

const css = (source: string) => onAccentOffenders('x.css', source);
const REDIRECT = '--wzl-fg-muted: var(--wzl-fg-muted-on-accent); --wzl-fg-subtle: var(--wzl-fg-subtle-on-accent);';

describe('onAccentOffenders', () => {
  it('catches on-accent text with no redirect', () => {
    expect(css('.a {\n  background: var(--wzl-accent);\n  color: var(--wzl-fg-on-accent);\n}')).toMatchObject([{ line: 3 }]);
  });

  it('catches a rule redirecting only one step', () => {
    expect(css('.a { color: var(--wzl-fg-on-accent); --wzl-fg-muted: var(--wzl-fg-muted-on-accent); }')).toHaveLength(1);
  });

  it('passes a rule redirecting both steps', () => {
    expect(css(`.a { color: var(--wzl-fg-on-accent); ${REDIRECT} }`)).toEqual([]);
  });

  it('does not count a redirect in a nested block', () => {
    expect(onAccentOffenders('x.less', `.a { color: var(--wzl-fg-on-accent); .b { ${REDIRECT} } }`)).toHaveLength(1);
  });

  it('passes the token used as a fill rather than as text', () => {
    expect(css('.knob { background: var(--wzl-fg-on-accent); }')).toEqual([]);
  });

  it('ignores a commented-out rule', () => {
    expect(css('/* .a { color: var(--wzl-fg-on-accent); } */')).toEqual([]);
  });
});
