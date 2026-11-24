import { describe, expect, it } from 'vitest';
import { parseFile } from './ast.ts';
import { freeNames } from './freeNames.ts';

const namesIn = (code: string): Set<string> => freeNames(parseFile(code, 'x.tsx'));

describe('freeNames', () => {
  it('reads the decorators of a class method and of its parameters', () => {
    const names = namesIn('class Panel { @bound handle(@inject(Token) x) { return x; } @track("x") #render() {} }');
    expect(names).toContain('bound');
    expect(names).toContain('inject');
    expect(names).toContain('Token');
    expect(names).toContain('track');
    expect(names).not.toContain('x');
  });

});
