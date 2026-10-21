import { describe, expect, it } from 'vitest';
import { offenders } from './check-labels';

const file = (source: string) => [{ path: 'x.css', source }];
const INHERITS =
  'text-transform: var(--wzl-params-label-case, uppercase); letter-spacing: var(--wzl-params-label-tracking, var(--wzl-tracking-wide));';

describe('offenders', () => {
  it('passes a label that inherits both', () => {
    expect(offenders(file(`.a { ${INHERITS} }`))).toEqual([]);
  });

  it('catches a literal case', () => {
    expect(offenders(file('.a { text-transform: uppercase; letter-spacing: var(--wzl-params-label-tracking, var(--wzl-tracking-wide)); }'))).toMatchObject([
      { line: 1, problem: expect.stringContaining('text-transform: uppercase') },
    ]);
  });

  it('catches a literal tracking', () => {
    expect(offenders(file('.a { text-transform: var(--wzl-params-label-case, uppercase); letter-spacing: 0.05em; }'))).toMatchObject([
      { problem: expect.stringContaining('letter-spacing: 0.05em') },
    ]);
  });

  it('catches drift moved into a fallback', () => {
    expect(offenders(file('.a { text-transform: var(--wzl-params-label-case, lowercase); letter-spacing: var(--wzl-params-label-tracking, 0.04em); }'))).toHaveLength(2);
  });

  it('catches a cased label that sets no tracking', () => {
    expect(offenders(file('.a { text-transform: var(--wzl-params-label-case, uppercase); }'))).toMatchObject([
      { problem: expect.stringContaining('sets no letter-spacing') },
    ]);
  });

  it('leaves a rule alone when it sets no case', () => {
    expect(offenders(file('.help { letter-spacing: normal; }'))).toEqual([]);
  });

  it('ignores declarations inside comments', () => {
    expect(offenders(file('/* .a { text-transform: uppercase; } */\n.b { color: red; }'))).toEqual([]);
  });

  it('passes a row label whose size reads the params property', () => {
    expect(offenders(file('.row > .rowLabel { font-size: var(--wzl-params-text-size, var(--wzl-font-size-sm)); }'))).toEqual([]);
  });

  it('catches a row label set at a size of its own', () => {
    expect(offenders(file('.a { color: red; }\n.rowLabel,\n.lk-pair-label { font-size: var(--wzl-font-size-sm); }'))).toMatchObject([
      { line: 3, problem: expect.stringContaining('row label font-size: var(--wzl-font-size-sm)') },
    ]);
  });

  it('leaves a size alone on what sits inside a row label', () => {
    expect(offenders(file('.rowLabel .help { font-size: var(--wzl-font-size-2xs); }\n.rowLabelNote { font-size: 9px; }'))).toEqual([]);
  });

  it('reports the line the rule starts on', () => {
    expect(offenders(file('.a { color: red; }\n\n.b {\n  text-transform: none;\n  letter-spacing: 0;\n}'))[0]).toMatchObject({ line: 3 });
  });
});
