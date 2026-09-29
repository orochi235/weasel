import { describe, it, expect } from 'vitest';
import { checkRequirements, satisfiesRange } from './kitRequirements';

describe('satisfiesRange', () => {
  const cases: [string, string, boolean][] = [
    ['1.7.0', '^1.7', true],
    ['1.9.3', '^1.7', true],
    ['2.0.0', '^1.7', false],
    ['1.6.9', '^1.7', false],
    ['0.3.4', '^0.3.1', true],
    ['0.4.0', '^0.3.1', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.7.5', '~1.7.2', true],
    ['1.8.0', '~1.7.2', false],
    ['1.9.0', '~1', true],
    ['1.7.3', '1.7.3', true],
    ['1.7.4', '1.7.3', false],
    ['1.7.4', '=1.7.3', false],
    ['1.7.9', '1.7', true],
    ['1.7.9', '1.7.x', true],
    ['1.8.0', '1.7.x', false],
    ['1.8.0', '1.x', true],
    ['5.0.0', '*', true],
    ['1.8.0', '>=1.7 <2', true],
    ['2.0.0', '>=1.7 <2', false],
    ['1.8.0', '>1.7', true],
    ['1.7.9', '>1.7', false],
    ['1.7.9', '<=1.7', true],
    ['1.8.0', '<=1.7', false],
    ['1.6.0', '<1.7', true],
    ['1.7.0', '<1.7', false],
    ['3.1.0', '^1.7 || ^3', true],
    ['2.1.0', '^1.7 || ^3', false],
    ['1.7.0-beta.1', '>=1.7.0', false],
    ['1.7.0-beta.1', '>=1.6.0', true],
    ['1.7.0+build.5', '1.7.0', true],
  ];
  it.each(cases)('%s against %s is %s', (version, range, expected) => {
    expect(satisfiesRange(version, range)).toBe(expected);
  });

  it('answers null for a range it cannot read', () => {
    expect(satisfiesRange('1.0.0', '1.0.0 - 2.0.0')).toBeNull();
    expect(satisfiesRange('1.0.0', 'latest')).toBeNull();
    expect(satisfiesRange('1.0.0', '')).toBeNull();
  });
});

describe('checkRequirements', () => {
  it('reports nothing when every requirement is met', () => {
    expect(checkRequirements({ core: '^1.7' }, { core: '1.8.2' })).toEqual([]);
  });

  it('reports an unmet requirement with the running version', () => {
    expect(checkRequirements({ core: '^2' }, { core: '1.8.2' })).toEqual([
      { package: 'core', range: '^2', running: '1.8.2', reason: 'unsatisfied' },
    ]);
  });

  it('reports a range it cannot read', () => {
    expect(checkRequirements({ core: 'latest' }, { core: '1.8.2' })).toEqual([
      { package: 'core', range: 'latest', running: '1.8.2', reason: 'invalid-range' },
    ]);
  });

  it('reports a package that does not report a version', () => {
    const requires = { hud: '^1' } as unknown as { core?: string };
    expect(checkRequirements(requires, { core: '1.8.2' })).toEqual([
      { package: 'hud', range: '^1', running: undefined, reason: 'unknown-package' },
    ]);
  });

  it('skips a package whose build does not know its own version', () => {
    expect(checkRequirements({ core: '^9' }, { core: '0.0.0-unknown' })).toEqual([]);
  });
});
