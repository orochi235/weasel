import { describe, expect, it } from 'vitest';
import { ladder, offenders } from './check-spacing';

const RUNGS = ladder(`
:root {
  --wzl-space-1: 2px;
  --wzl-space-2: 4px;
  --wzl-space-4: 8px;
}
`);

const file = (source: string) => [{ path: 'x.css', source }];

describe('ladder', () => {
  it('reads the rungs out of the generated tokens', () => {
    expect([...RUNGS]).toEqual([
      [2, '1'],
      [4, '2'],
      [8, '4'],
    ]);
  });
});

describe('offenders', () => {
  it('catches a spacing literal that has a rung', () => {
    expect(offenders(file('.a { gap: 8px; }'), RUNGS)).toMatchObject([{ line: 1, rung: '4' }]);
  });

  it('catches each length of a shorthand', () => {
    expect(offenders(file('.a { padding: 4px 8px; }'), RUNGS)).toHaveLength(2);
  });

  it('passes a literal with no rung', () => {
    expect(offenders(file('.a { gap: 5px; }'), RUNGS)).toEqual([]);
  });

  it('passes a property that is not spacing', () => {
    expect(offenders(file('.a { border: 8px solid red; }'), RUNGS)).toEqual([]);
    expect(offenders(file('.a { box-shadow: 0 8px 8px red; }'), RUNGS)).toEqual([]);
  });

  // A fallback is the default of the property it belongs to, not of the one declaring it.
  it('passes a length inside a var() fallback', () => {
    expect(offenders(file('.a { margin-left: var(--thumb, 8px); }'), RUNGS)).toEqual([]);
  });

  it('catches a length beside a var() fallback it is not inside', () => {
    expect(offenders(file('.a { padding: var(--thumb, 5px) 8px; }'), RUNGS)).toMatchObject([{ rung: '4' }]);
  });

  it('passes a negative length, which has no rung', () => {
    expect(offenders(file('.a { margin-top: -8px; }'), RUNGS)).toEqual([]);
  });

  it('passes a value already on the ladder', () => {
    expect(offenders(file('.a { gap: var(--wzl-space-4); }'), RUNGS)).toEqual([]);
  });
});
