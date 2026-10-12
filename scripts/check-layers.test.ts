import { describe, expect, it } from 'vitest';
import { floor, offenders } from './check-layers';

const FLOOR = floor(`
:root {
  --wzl-z-toolbar: 10;
  --wzl-z-modal: 1000;
}
`);

const file = (source: string, path = 'x.css') => [{ path, source }];

describe('floor', () => {
  it('is the lowest rung of the generated ladder', () => {
    expect(FLOOR).toBe(10);
  });
});

describe('offenders', () => {
  it('catches a z-index literal at or above the lowest rung', () => {
    expect(offenders(file('.a {\n  z-index: 1200;\n}'), FLOOR)).toMatchObject([{ line: 2 }]);
    expect(offenders(file('.a { z-index: 10; }'), FLOOR)).toHaveLength(1);
  });

  it('catches one set in script', () => {
    expect(offenders(file("el.style.zIndex = '10000';", 'x.ts'), FLOOR)).toHaveLength(1);
    expect(offenders(file('const style = { zIndex: 9999 };', 'x.tsx'), FLOOR)).toHaveLength(1);
  });

  it('passes an order within one stacking context', () => {
    expect(offenders(file('.a { z-index: 2; }\n.b { z-index: -1; }'), FLOOR)).toEqual([]);
  });

  it('passes a rung, with or without a fallback', () => {
    expect(offenders(file('.a { z-index: var(--wzl-z-modal); }'), FLOOR)).toEqual([]);
    expect(offenders(file('.a { z-index: var(--wzl-z-hud, 900); }'), FLOOR)).toEqual([]);
    expect(offenders(file("el.style.zIndex = 'var(--wzl-z-drag, 10000)';", 'x.ts'), FLOOR)).toEqual([]);
  });

  it('passes a literal in a comment', () => {
    expect(offenders(file('/* was z-index: 1000; */'), FLOOR)).toEqual([]);
  });
});
